import {WorldSimulation} from './simulation';
import type {PhysicsCommand,PhysicsFrame,PhysicsFailure} from './protocol';
const scope=globalThis as unknown as {postMessage(value:PhysicsFrame|PhysicsFailure,transfer?:Transferable[]):void;onmessage:((event:MessageEvent<PhysicsCommand>)=>void)|null;close():void};
const simulation=new WorldSimulation();let timer:ReturnType<typeof setInterval>|undefined;let paused=false,fps=25;
const publish=(frame:PhysicsFrame)=>scope.postMessage(frame,[frame.positions.buffer]);
const schedule=()=>{if(timer)clearInterval(timer);timer=undefined;if(!paused)timer=setInterval(()=>{try{publish(simulation.step());}catch(error){scope.postMessage({type:'error',message:String(error)});}},1000/fps);};
scope.onmessage=event=>{try{const command=event.data;if(command.type==='dispose'){if(timer)clearInterval(timer);simulation.destroy();scope.close();return;}simulation.command(command);if(command.type==='pause'){paused=command.paused;fps=command.fps;schedule();}else if(command.type==='graph'&&!timer)schedule();publish(simulation.frame());}catch(error){scope.postMessage({type:'error',message:String(error)});}};
