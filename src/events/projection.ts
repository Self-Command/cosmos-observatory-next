import type { ObservatoryEvent } from '../core/types';
export interface ToolRun { key:string;source:string;sessionId:string;runId:string;toolId:string;name:string;startedAt?:number;endedAt?:number;status:ObservatoryEvent['status'];phase:'running'|'complete'|'unknown';paths:string[];events:ObservatoryEvent[] }
export function projectTools(events:ObservatoryEvent[]):ToolRun[]{
  const tools=new Map<string,ToolRun>();
  for(const event of events){if(event.kind!=='agent'||event.action.startsWith('session.'))continue;const toolId=event.toolId??event.runId??event.id,key=`${event.source}:${event.sessionId}:${event.runId}:${toolId}`;
    const tool=tools.get(key)??{key,source:event.source,sessionId:event.sessionId??'',runId:event.runId??'',toolId,name:event.toolName??'未登记工具',status:'unknown',phase:'unknown',paths:[],events:[]};
    tool.events.push(event);if(event.path&&!tool.paths.includes(event.path))tool.paths.push(event.path);
    if(event.action==='tool.start'){tool.startedAt=Math.min(tool.startedAt??event.at,event.at);if(tool.endedAt===undefined)tool.phase='running';}
    else if(tool.endedAt===undefined||event.at>=tool.endedAt){tool.endedAt=event.at;tool.status=event.status;tool.phase='complete';}
    tools.set(key,tool);
  }
  for(const tool of tools.values())if(tool.endedAt===undefined){tool.status='unknown';if(events.some(event=>event.kind==='agent'&&event.source===tool.source&&event.sessionId===tool.sessionId&&event.action==='session.end'))tool.phase='unknown';}
  return [...tools.values()].sort((a,b)=>(b.endedAt??b.startedAt??0)-(a.endedAt??a.startedAt??0));
}
