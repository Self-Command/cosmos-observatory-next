import type {Vec3,WorldLayout} from '../core/types';
import type {Settings} from '../core/settings';
export interface PhysicsNode {id:string;worldId:string;position:Vec3;fixed:boolean;center:boolean;radius:number;radial:number}
export interface PhysicsWorld {id:string;layout:WorldLayout;radius:number}
export interface PhysicsLink {source:string;target:string}
export interface PhysicsParameters {center:number;repulsion:number;link:number;crossLink:number;distance:number;radial:number;collision:number;damping:number;rotation:number;motion:number}
export const physicsParameters=(settings:Settings):PhysicsParameters=>({center:Number(settings.centerForce),repulsion:Number(settings.repulsion),link:Number(settings.linkForce),crossLink:Number(settings.crossLinkForce),distance:Number(settings.linkDistance),radial:Number(settings.radialForce),collision:Number(settings.collisionPadding),damping:Number(settings.damping),rotation:Number(settings.worldRotation),motion:Number(settings.floatAmplitude)*Number(settings.floatSpeed)});
export type PhysicsCommand=
  |{type:'graph';revision:number;sequence:number;nodes:PhysicsNode[];worlds:PhysicsWorld[];links:PhysicsLink[];parameters:PhysicsParameters;reset?:boolean}
  |{type:'parameters';sequence:number;parameters:PhysicsParameters}
  |{type:'world';sequence:number;id:string;layout:WorldLayout;radius:number;phase:'start'|'move'|'end'|'cancel'}
  |{type:'node';sequence:number;id:string;position:Vec3;phase:'start'|'move'|'end'|'cancel'}
  |{type:'pin';sequence:number;id:string;fixed:boolean;position:Vec3}
  |{type:'pause';sequence:number;paused:boolean;fps:number}
  |{type:'dispose';sequence:number};
export interface PhysicsFrame {type:'frame';revision:number;sequence:number;positions:Float32Array;duration:number;tick:number}
export interface PhysicsFailure {type:'error';message:string}
