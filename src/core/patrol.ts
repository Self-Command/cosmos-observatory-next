import PQueue from 'p-queue';
import cytoscape from 'cytoscape';
import { inspectSyntax, supportsSyntax } from './syntax';
import type { FileDescriptor, InspectionResult, PatrolState, RelationDescriptor } from './types';
import type { Settings } from './settings';
export interface PatrolPort { files():FileDescriptor[]; relations():RelationDescriptor[]; read(file:FileDescriptor):Promise<string>; current(id:string):FileDescriptor|undefined; unresolved(file:FileDescriptor):string[]; hash(text:string):Promise<string>; result(result:InspectionResult):void; state(state:PatrolState):void }
export class Patrol {
  private queue=new PQueue({concurrency:1});private pending=new Set<string>();private changes=new Map<string,FileDescriptor>();private last=new Map<string,{version:string;at:number}>();private timer:ReturnType<typeof setInterval>|undefined;private cursor=0;private stopped=false;private epoch=0;private previous:string|undefined;private graph:cytoscape.Core|undefined;private graphSignature='';
  state:PatrolState={phase:'idle',route:[],direct:false,completed:0,scheduled:0,reads:0,skipped:0,failed:0,discarded:0};
  constructor(private port:PatrolPort,private settings:Settings){}
  restoreCounters(state:PatrolState){for(const key of ['completed','scheduled','reads','skipped','failed','discarded'] as const)this.state[key]=Math.max(0,Number(state[key]??0));}
  configure(settings:Settings){this.settings=settings;if(this.timer)clearInterval(this.timer);this.timer=undefined;if(!this.stopped&&settings.patrolEnabled&&!settings.patrolPaused){this.queue.start();this.timer=setInterval(()=>this.tick(),Number(settings.patrolInterval)*1000);if(!this.queue.pending)this.update({phase:'idle'});}else this.suspend();}
  start(){this.stopped=false;this.configure(this.settings);this.tick();}
  changed(file:FileDescriptor){if(!this.stopped){this.changes.delete(file.id);this.changes.set(file.id,file);}}
  manual(id:string){if(this.stopped)throw Error('巡查已停止');const file=this.port.current(id);if(!file)throw Error('文件不存在');if(this.pending.has(id))return;this.last.delete(id);this.changes.delete(id);this.queue.start();this.enqueue(file,true,true);}
  private update(patch:Partial<PatrolState>){this.state={...this.state,...patch};this.port.state(this.state);}
  private count(key:'scheduled'|'reads'|'skipped'|'failed'|'discarded'|'completed'){this.update({[key]:(this.state[key]??0)+1});}
  private tick(){if(this.stopped||!this.settings.patrolEnabled||this.settings.patrolPaused||this.queue.size||this.queue.pending)return;const files=this.port.files(),ids=new Set(files.map(file=>file.id));for(const id of this.last.keys())if(!ids.has(id))this.last.delete(id);for(const [id] of [...this.changes].reverse()){this.changes.delete(id);const current=this.port.current(id);if(current){this.enqueue(current,true);return;}}for(let i=0;i<files.length;i++){const file=files[this.cursor++%files.length];const last=this.last.get(file.id);if(!last||last.version!==file.version||Date.now()-last.at>=Number(this.settings.revisitSeconds)*1000){this.enqueue(file,false);break;}}}
  private route(target:string){if(!this.previous)return [];const files=this.port.files(),relations=this.port.relations();const signature=files.map(f=>f.id).join('|')+relations.map(r=>r.id).join('|');if(signature!==this.graphSignature||!this.graph){this.graph?.destroy();this.graph=cytoscape({headless:true,elements:[...files.map(f=>({data:{id:f.id}})),...relations.map(r=>({data:{id:r.id,source:r.source,target:r.target}}))]});this.graphSignature=signature;}const cy=this.graph,from=cy.getElementById(this.previous),to=cy.getElementById(target);if(!from.length||!to.length)return [];const route=cy.elements().aStar({root:from,goal:to,directed:false});return route.found?route.path.nodes().map(n=>n.id()):[];}
  private enqueue(file:FileDescriptor,priority:boolean,manual=false){if(this.stopped||(!manual&&(!this.settings.patrolEnabled||this.settings.patrolPaused))||this.pending.has(file.id))return;this.pending.add(file.id);this.count('scheduled');const epoch=this.epoch;void this.queue.add(async()=>{
    let base:InspectionResult|undefined;
    try{
      if(epoch!==this.epoch||this.stopped)return;const current=this.port.current(file.id);if(!current)return;const route=this.route(current.id);this.update({phase:'locating',taskId:crypto.randomUUID(),targetId:current.id,fromId:this.previous,route,direct:route.length===0,startedAt:Date.now()});this.update({phase:'checking'});
      base={fileId:current.id,path:current.path,version:current.version,hash:'',checkedAt:Date.now(),status:'pending',issues:[],rules:[],unassessed:[],dependencies:[],read:'skipped',bytesRead:0};
      if(current.size>Number(this.settings.maxReadKiB)*1024){base.status='unassessed';base.unassessed=['文件超过读取上限'];this.count('skipped');}
      else if(!supportsSyntax(current.extension)){base.status='unassessed';base.unassessed=['该文件类型未提供静态解析器；未读取'];this.count('skipped');}
      else{
        const text=await this.port.read(current);base.read='read';base.bytesRead=new TextEncoder().encode(text).byteLength;this.count('reads');base.hash=await this.port.hash(text);Object.assign(base,inspectSyntax(current,text));
        if(current.extension==='md'&&!current.cacheReady){base.unassessed.push('Obsidian 链接缓存待就绪');base.status='pending';}
        else{for(const link of this.port.unresolved(current))base.issues.push({rule:'obsidian.links',message:`未解析链接: ${link}`});base.status=base.issues.length?'issues':base.unassessed.length?'unassessed':'pass';}
      }
      const latest=this.port.current(current.id);
      if(epoch!==this.epoch||this.stopped||!latest||latest.version!==current.version||latest.path!==current.path){this.count('discarded');if(latest&&!this.stopped)this.changes.set(latest.id,latest);return;}
      base.checkedAt=Date.now();this.port.result(base);if(base.read==='read'&&base.status!=='pending')this.count('completed');
      // Cache readiness may change without content version changing; pending checks remain retryable.
      if(base.status!=='pending')this.last.set(current.id,{version:current.version,at:base.checkedAt});this.previous=current.id;
    }catch(error){const latest=this.port.current(file.id);if(epoch===this.epoch&&!this.stopped&&latest?.version===file.version){this.count('failed');this.port.result({...base,fileId:file.id,path:file.path,version:file.version,hash:base?.hash??'',checkedAt:Date.now(),status:'failed',issues:[],unassessed:[`读取或检查失败: ${String(error)}`],rules:base?.rules??[],dependencies:[],read:base?.read==='read'?'read':'failed'});this.last.set(file.id,{version:file.version,at:Date.now()});}}
    finally{this.pending.delete(file.id);if(epoch===this.epoch&&!this.stopped)this.update({phase:this.settings.patrolPaused||!this.settings.patrolEnabled?'paused':'idle'});}
  },{priority:priority?1:0}).catch(()=>{});}
  suspend(){this.epoch++;this.queue.pause();this.queue.clear();this.pending.clear();if(this.timer)clearInterval(this.timer);this.timer=undefined;this.update({phase:'paused'});}
  async flush(){await this.queue.onIdle();}
  destroy(){this.stopped=true;this.suspend();this.changes.clear();this.last.clear();this.graph?.destroy();this.graph=undefined;}
}
