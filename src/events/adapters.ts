import path from 'node:path';
import {createHash} from 'node:crypto';
import type {ObservatoryEvent} from '../core/types';
export type SourceEvent=Omit<ObservatoryEvent,'kind'|'evidence'|'fileId'>;
const status=(value:unknown):ObservatoryEvent['status']=>value==='completed'||value==='success'?'success':value==='failed'?'failed':value==='declined'||value==='interrupted'?'cancelled':'unknown';
function target(root:string,value:unknown){if(typeof value!=='string')return;const platform=/^[a-z]:[\\/]/i.test(root)?path.win32:path.posix;const resolved=platform.resolve(root,value),relative=platform.relative(platform.resolve(root),resolved).replaceAll('\\','/');if(!relative||relative.startsWith('../')||platform.isAbsolute(relative)||relative.startsWith('.obsidian/'))return;return relative;}
/** Project only documented fields. Never read transcripts, command text, diff or output. */
export function adaptClaude(input:Record<string,any>,vault:string,at=Date.now()):SourceEvent[]{
  const hook=input.hook_event_name,session=input.session_id;if(typeof session!=='string'||session.length>128)return [];
  const supported=['SessionStart','SessionEnd','PreToolUse','PostToolUse','PostToolUseFailure'];if(!supported.includes(hook))return [];
  const lifecycle=hook==='SessionStart'||hook==='SessionEnd',pre=hook==='PreToolUse',run=String(input.tool_use_id??'session').slice(0,128),file=target(vault,input.tool_input?.file_path??input.tool_input?.path);
  const success=hook==='PostToolUse',result=hook==='PostToolUseFailure'?'failed':lifecycle||success?'success':'unknown';
  const action:ObservatoryEvent['action']=hook==='SessionStart'?'session.start':hook==='SessionEnd'?'session.end':pre?'tool.start':['Write','Edit','MultiEdit'].includes(input.tool_name)&&file?'modify':input.tool_name==='Read'&&file?'read.partial':['Grep','Glob'].includes(input.tool_name)?'search':'tool.end';
  const sequence=lifecycle?0:pre?0:1,id=createHash('sha256').update(`${session}:${run}:${hook}:${file??''}`).digest('hex');
  return [{id,at,source:'claude-hook',action,sessionId:session,runId:run,status:result,sequence,...(file?{path:file}:{})}];
}
export function adaptCodex(input:Record<string,any>,vault:string,sequence:number,at=Date.now()):SourceEvent[]{
  const {method,params}=input;if(!['item/started','item/completed'].includes(method)||!params?.item)return [];
  const item=params.item,session=params.threadId,run=params.turnId;if(typeof session!=='string'||typeof run!=='string'||session.length>128||run.length>128)return [];
  const toolTypes=['fileChange','commandExecution','mcpToolCall','dynamicToolCall'];if(!toolTypes.includes(item.type))return [];
  const completed=method==='item/completed',result=completed?status(item.status):'unknown';
  const files=item.type==='fileChange'&&completed?Array.isArray(item.changes)?item.changes.map((change:any)=>target(vault,change.path)).filter(Boolean):[]:[];
  return (files.length?files:[undefined]).map((file,index)=>({id:createHash('sha256').update(`${session}:${run}:${item.id}:${method}:${index}`).digest('hex'),at,source:'codex-public-api',sessionId:session,runId:run,sequence:sequence+index,action:file?'modify':completed?'tool.end':'tool.start',status:result,...(file?{path:file}:{})}));
}
