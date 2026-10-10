import PQueue from 'p-queue';
import cytoscape from 'cytoscape';
import { inspectSyntax } from './syntax';
import type { FileDescriptor, InspectionResult, PatrolState, RelationDescriptor } from './types';
import type { Settings } from './settings';
export interface PatrolPort { files():FileDescriptor[]; relations():RelationDescriptor[]; read(file:FileDescriptor):Promise<string>; current(id:string):FileDescriptor|undefined; unresolved(file:FileDescriptor):string[]; hash(text:string):Promise<string>; result(result:InspectionResult):void; state(state:PatrolState):void }
export class Patrol {
  private queue=new PQueue({concurrency:1});private pending=new Set<string>();private last=new Map<string,{version:string;at:number}>();private timer:ReturnType<typeof setInterval>|undefined;private cursor=0;private stopped=false;private epoch=0;private previous:string|undefined;
  state:PatrolState={phase:'idle',route:[],direct:false,completed:0};
  constructor(private port:PatrolPort,private settings:Settings){}
  configure(settings:Settings){this.settings=settings;if(this.timer)clearInterval(this.timer);this.timer=undefined;if(!this.stopped&&settings.patrolEnabled&&!settings.patrolPaused){this.queue.start();this.timer=setInterval(()=>this.tick(),Number(settings.patrolInterval)*1000);}else this.queue.pause();this.update({phase:settings.patrolPaused?'paused':'idle'});}
  start(){this.stopped=false;this.configure(this.settings);this.tick();}
  changed(file:FileDescriptor){this.enqueue(file,true);}
  private update(patch:Partial<PatrolState>){this.state={...this.state,...patch};this.port.state(this.state);}
  private tick(){if(this.stopped||!this.settings.patrolEnabled||this.settings.patrolPaused||this.queue.size||this.queue.pending)return;const files=this.port.files();for(let i=0;i<files.length;i++){const file=files[this.cursor++%files.length];const last=this.last.get(file.id);if(!last||last.version!==file.version||Date.now()-last.at>=Number(this.settings.revisitSeconds)*1000){this.enqueue(file,false);break;}}}
  private route(target:string){if(!this.previous)return [];const cy=cytoscape({headless:true,elements:[...this.port.files().map(f=>({data:{id:f.id}})),...this.port.relations().map(r=>({data:{id:r.id,source:r.source,target:r.target}}))]});try{const from=cy.getElementById(this.previous),to=cy.getElementById(target);if(!from.length||!to.length)return [];const route=cy.elements().aStar({root:from,goal:to,directed:false});return route.found?route.path.nodes().map(n=>n.id()):[];}finally{cy.destroy();}}
  private enqueue(file:FileDescriptor,priority:boolean){if(this.stopped||!this.settings.patrolEnabled||this.settings.patrolPaused||this.pending.has(file.id))return;this.pending.add(file.id);const epoch=this.epoch;void this.queue.add(async()=>{
    try{if(epoch!==this.epoch||this.stopped)return;const current=this.port.current(file.id);if(!current)return;const route=this.route(current.id);this.update({phase:'locating',taskId:crypto.randomUUID(),targetId:current.id,fromId:this.previous,route,direct:route.length===0,startedAt:Date.now()});this.update({phase:'checking'});
      const base={fileId:current.id,path:current.path,version:current.version,hash:'',checkedAt:Date.now(),issues:[],rules:[],unassessed:[],dependencies:[]} as InspectionResult;
      if(current.size>Number(this.settings.maxReadKiB)*1024){base.status='unassessed';base.unassessed=['文件超过读取上限'];}
      else{const text=await this.port.read(current);base.hash=await this.port.hash(text);Object.assign(base,inspectSyntax(current,text));if(current.extension==='md'&&!current.cacheReady){base.unassessed.push('Obsidian 链接缓存待就绪');base.status='pending';}else{for(const link of this.port.unresolved(current))base.issues.push({rule:'obsidian.links',message:`未解析链接: ${link}`});base.status=base.issues.length?'issues':base.unassessed.length?'unassessed':'pass';}}
      const latest=this.port.current(current.id);if(epoch!==this.epoch||this.stopped||!latest||latest.version!==current.version)return;
      base.checkedAt=Date.now();this.port.result(base);this.last.set(current.id,{version:current.version,at:base.checkedAt});this.previous=current.id;this.update({phase:'idle',completed:this.state.completed+1});
    }catch(error){const latest=this.port.current(file.id);if(epoch===this.epoch&&!this.stopped&&latest?.version===file.version)this.port.result({fileId:file.id,path:file.path,version:file.version,hash:'',checkedAt:Date.now(),status:'failed',issues:[],unassessed:[`读取失败: ${String(error)}`],rules:[],dependencies:[]});this.update({phase:'idle'});}finally{this.pending.delete(file.id);}
  },{priority:priority?1:0}).catch(()=>{});}
  suspend(){this.epoch++;this.queue.pause();this.queue.clear();this.pending.clear();if(this.timer)clearInterval(this.timer);this.timer=undefined;this.update({phase:'paused'});}
  destroy(){this.stopped=true;this.suspend();}
}
