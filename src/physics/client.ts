import source from './physics.worker.ts?worker';
import type {Vec3,WorldLayout} from '../core/types';
import type {PhysicsCommand,PhysicsNode,PhysicsWorld,PhysicsLink,PhysicsParameters,PhysicsFrame,PhysicsFailure} from './protocol';
type WithoutSequence<T>=T extends unknown?Omit<T,'sequence'>:never;
export class PhysicsClient {
  private worker:Worker;private url:string;private sequence=0;private revision=0;private disposed=false;private durations:number[]=[];private frames=0;
  constructor(frame:(frame:PhysicsFrame)=>void,error:(message:string)=>void){this.url=URL.createObjectURL(new Blob([source],{type:'application/javascript'}));this.worker=new Worker(this.url);this.worker.onerror=event=>error(`引力模拟失败: ${event.message}`);this.worker.onmessage=(event:MessageEvent<PhysicsFrame|PhysicsFailure>)=>{if(this.disposed)return;if(event.data.type==='error'){error(event.data.message);return;}const data=event.data;if(data.revision!==this.revision||data.sequence!==this.sequence)return;this.frames++;this.durations.push(data.duration);if(this.durations.length>250)this.durations.shift();frame(data);};}
  private send(command:WithoutSequence<PhysicsCommand>){if(!this.disposed)this.worker.postMessage({...command,sequence:++this.sequence});}
  graph(nodes:PhysicsNode[],worlds:PhysicsWorld[],links:PhysicsLink[],parameters:PhysicsParameters,reset=false){this.send({type:'graph',revision:++this.revision,nodes,worlds,links,parameters,reset});}
  parameters(parameters:PhysicsParameters){this.send({type:'parameters',parameters});}
  world(id:string,layout:WorldLayout,radius:number,phase:'start'|'move'|'end'|'cancel'){this.send({type:'world',id,layout,radius,phase});}
  node(id:string,position:Vec3,phase:'start'|'move'|'end'|'cancel'){this.send({type:'node',id,position,phase});}
  pin(id:string,fixed:boolean,position:Vec3){this.send({type:'pin',id,fixed,position});}
  pause(paused:boolean,fps:number){this.send({type:'pause',paused,fps});}
  debug(){return {frames:this.frames,revision:this.revision,sequence:this.sequence,durations:this.durations,disposed:this.disposed};}
  destroy(){if(this.disposed)return;this.send({type:'dispose'});this.disposed=true;this.worker.terminate();URL.revokeObjectURL(this.url);}
}
