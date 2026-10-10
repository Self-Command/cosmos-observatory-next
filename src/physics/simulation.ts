import {forceSimulation,forceLink,forceManyBody,forceCollide,forceX,forceY,forceZ,type Simulation,type Link} from 'd3-force-3d';
import {Vector3,Quaternion,Euler} from 'three';
import type {Vec3,WorldLayout} from '../core/types';
import type {PhysicsCommand,PhysicsFrame,PhysicsNode,PhysicsWorld,PhysicsParameters} from './protocol';
interface Body extends PhysicsNode {x:number;y:number;z:number;vx:number;vy:number;vz:number;fx?:number|null;fy?:number|null;fz?:number|null}
interface Space extends PhysicsWorld {center:Vector3;quaternion:Quaternion;inverse:Quaternion}
interface BodyLink extends Link<Body> {source:string|Body;target:string|Body}
export class WorldSimulation {
  private simulation:Simulation<Body>;private bodies:Body[]=[];private byId=new Map<string,Body>();private worlds=new Map<string,Space>();private links:BodyLink[]=[];
  private parameters!:PhysicsParameters;private revision=0;private sequence=0;private ticks=0;private seed=1;
  private worldDrag=new Map<string,Map<string,Vec3>>();private nodeDrag=new Map<string,{position:Vec3;fixed:boolean}>();private point=new Vector3();
  constructor(){this.simulation=forceSimulation<Body>([],3).stop().alphaDecay(.015).alphaTarget(.1).randomSource(()=>this.random());}
  private random(){this.seed=(Math.imul(1664525,this.seed)+1013904223)>>>0;return this.seed/4294967296;}
  private space(world:PhysicsWorld):Space{const quaternion=new Quaternion().setFromEuler(new Euler(...world.layout.rotation));return {...world,center:new Vector3(...world.layout.position),quaternion,inverse:quaternion.clone().invert()};}
  private local(body:Body){const world=this.worlds.get(body.worldId)!;return this.point.set(body.x,body.y,body.z).sub(world.center).applyQuaternion(world.inverse);}
  private place(body:Body,position:Vec3){const world=this.worlds.get(body.worldId)!;this.point.fromArray(position).applyQuaternion(world.quaternion).add(world.center);body.x=this.point.x;body.y=this.point.y;body.z=this.point.z;body.vx=body.vy=body.vz=0;this.fix(body);}
  private fix(body:Body){const held=body.center||body.fixed||this.worldDrag.has(body.worldId)||this.nodeDrag.has(body.id);if(held){body.fx=body.x;body.fy=body.y;body.fz=body.z;}else{body.fx=body.fy=body.fz=null;}}
  command(command:PhysicsCommand){
    this.sequence=Math.max(this.sequence,command.sequence);
    if(command.type==='graph'){
      const old=this.byId;this.revision=command.revision;this.worlds=new Map(command.worlds.map(world=>[world.id,this.space(world)]));
      this.bodies=command.nodes.filter(node=>this.worlds.has(node.worldId)).map(node=>{const previous=old.get(node.id),body:Body={...node,x:0,y:0,z:0,vx:0,vy:0,vz:0};if(previous&&previous.worldId===node.worldId&&!node.center){body.x=previous.x;body.y=previous.y;body.z=previous.z;body.vx=previous.vx;body.vy=previous.vy;body.vz=previous.vz;this.fix(body);}else this.place(body,node.center?[0,0,0]:node.position);return body;});
      this.byId=new Map(this.bodies.map(body=>[body.id,body]));this.links=command.links.filter(link=>this.byId.has(link.source)&&this.byId.has(link.target)&&link.source!==link.target).map(link=>({...link}));this.simulation.nodes(this.bodies);this.parameters=command.parameters;this.configure();this.constrain();this.simulation.alpha(.8);
    }else if(command.type==='parameters'){this.parameters=command.parameters;this.configure();this.simulation.alpha(.6);}
    else if(command.type==='world')this.moveWorld(command.id,command.layout,command.radius,command.phase);
    else if(command.type==='node')this.moveNode(command.id,command.position,command.phase);
    else if(command.type==='pin'){const body=this.byId.get(command.id);if(body&&!body.center){body.fixed=command.fixed;this.place(body,command.position);this.simulation.alpha(.7);}}
    else if(command.type==='dispose')this.simulation.stop();
  }
  private configure(){
    if(!this.parameters)return;const p=this.parameters;
    this.simulation.velocityDecay(p.damping)
      .force('center-x',forceX<Body>(body=>this.worlds.get(body.worldId)!.center.x).strength(p.center))
      .force('center-y',forceY<Body>(body=>this.worlds.get(body.worldId)!.center.y).strength(p.center))
      .force('center-z',forceZ<Body>(body=>this.worlds.get(body.worldId)!.center.z).strength(p.center))
      .force('repulsion',forceManyBody<Body>().strength(-p.repulsion).distanceMax(Math.max(1,...[...this.worlds.values()].map(world=>world.radius*2.5))).theta(.95))
      .force('collision',forceCollide<Body>(body=>body.radius+p.collision).strength(.9).iterations(1))
      .force('links',forceLink<Body,BodyLink>(this.links).id(body=>body.id).distance(link=>{const a=link.source as Body,b=link.target as Body;if(a.worldId===b.worldId)return p.distance;const first=this.worlds.get(a.worldId)!,second=this.worlds.get(b.worldId)!;return Math.max(p.distance,first.center.distanceTo(second.center)-first.radius-second.radius+p.distance);}).strength(link=>(link.source as Body).worldId===(link.target as Body).worldId?p.link:p.crossLink))
      .force('world-layers',alpha=>{for(const body of this.bodies){if(body.center||body.fixed||this.worldDrag.has(body.worldId)||this.nodeDrag.has(body.id))continue;const world=this.worlds.get(body.worldId)!,local=this.local(body),length=local.length(),radial=Math.min(world.radius-body.radius,body.radial),force=(radial-length)*p.radial*alpha;const acceleration=local.clone().normalize().multiplyScalar(force);acceleration.x+=local.z*p.rotation*.015;acceleration.z-=local.x*p.rotation*.015;if(p.motion){acceleration.x+=(this.random()-.5)*p.motion*.004;acceleration.y+=(this.random()-.5)*p.motion*.004;acceleration.z+=(this.random()-.5)*p.motion*.004;}acceleration.applyQuaternion(world.quaternion);body.vx+=acceleration.x;body.vy+=acceleration.y;body.vz+=acceleration.z;}});
  }
  private moveWorld(id:string,layout:WorldLayout,radius:number,phase:'start'|'move'|'end'|'cancel'){
    const world=this.worlds.get(id);if(!world)return;
    const relative=this.worldDrag.get(id)??new Map(this.bodies.filter(body=>body.worldId===id).map(body=>[body.id,this.local(body).toArray() as Vec3]));
    if(phase==='start'||phase==='move')this.worldDrag.set(id,relative);this.worlds.set(id,this.space({id,layout,radius}));
    for(const [bodyId,position] of relative){const body=this.byId.get(bodyId);if(body)this.place(body,position);}
    if(phase==='end'||phase==='cancel'){this.worldDrag.delete(id);for(const body of this.bodies)if(body.worldId===id)this.fix(body);}
    this.configure();this.simulation.alpha(.65);
  }
  private moveNode(id:string,position:Vec3,phase:'start'|'move'|'end'|'cancel'){
    const body=this.byId.get(id);if(!body||body.center)return;
    if(phase==='start')this.nodeDrag.set(id,{position:this.local(body).toArray() as Vec3,fixed:body.fixed});
    const previous=this.nodeDrag.get(id);this.place(body,phase==='cancel'&&previous?previous.position:position);
    if(phase==='end'||phase==='cancel'){if(phase==='cancel'&&previous)body.fixed=previous.fixed;this.nodeDrag.delete(id);this.fix(body);}
    this.simulation.alpha(.85);
  }
  private constrain(){
    for(const body of this.bodies){if(body.center){this.place(body,[0,0,0]);continue;}if(this.worldDrag.has(body.worldId))continue;const world=this.worlds.get(body.worldId)!,local=this.local(body),radius=Math.max(.02,world.radius-body.radius),length=local.length();if(length>radius){local.multiplyScalar(radius/length).applyQuaternion(world.quaternion).add(world.center);body.x=local.x;body.y=local.y;body.z=local.z;body.vx*=.3;body.vy*=.3;body.vz*=.3;if(body.fixed||this.nodeDrag.has(body.id))this.fix(body);}}
  }
  step(iterations=1){const before=performance.now();this.simulation.tick(iterations);this.constrain();this.ticks+=iterations;return this.frame(performance.now()-before);}
  frame(duration=0):PhysicsFrame{const positions=new Float32Array(this.bodies.length*3);for(const [index,body] of this.bodies.entries())this.local(body).toArray(positions,index*3);return {type:'frame',revision:this.revision,sequence:this.sequence,positions,duration,tick:this.ticks};}
  destroy(){this.simulation.stop();this.bodies=[];this.byId.clear();this.worlds.clear();this.worldDrag.clear();this.nodeDrag.clear();}
}
