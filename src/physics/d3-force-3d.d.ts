declare module 'd3-force-3d' {
  export interface SimulationNode {index?:number;x?:number;y?:number;z?:number;vx?:number;vy?:number;vz?:number;fx?:number|null;fy?:number|null;fz?:number|null}
  export interface Force<N extends SimulationNode> {(alpha:number):void;initialize?:(nodes:N[],random:()=>number,dimensions:number)=>void}
  export interface Simulation<N extends SimulationNode> {stop():this;tick(iterations?:number):this;nodes():N[];nodes(nodes:N[]):this;alpha():number;alpha(value:number):this;alphaTarget(value:number):this;alphaDecay(value:number):this;velocityDecay(value:number):this;force(name:string,force:Force<N>|null):this;randomSource(random:()=>number):this}
  export interface Link<N> {source:string|N;target:string|N;index?:number}
  export interface LinkForce<N extends SimulationNode,L extends Link<N>> extends Force<N> {id(get:(node:N)=>string):this;distance(value:number|((link:L)=>number)):this;strength(value:number|((link:L)=>number)):this;iterations(value:number):this}
  export interface ManyBodyForce<N extends SimulationNode> extends Force<N> {strength(value:number):this;distanceMax(value:number):this;theta(value:number):this}
  export interface CollisionForce<N extends SimulationNode> extends Force<N> {strength(value:number):this;iterations(value:number):this}
  export interface AxisForce<N extends SimulationNode> extends Force<N> {strength(value:number):this}
  export function forceSimulation<N extends SimulationNode>(nodes:N[],dimensions?:number):Simulation<N>;
  export function forceLink<N extends SimulationNode,L extends Link<N>>(links:L[]):LinkForce<N,L>;
  export function forceManyBody<N extends SimulationNode>():ManyBodyForce<N>;
  export function forceCollide<N extends SimulationNode>(radius:number|((node:N)=>number)):CollisionForce<N>;
  export function forceX<N extends SimulationNode>(position:number|((node:N)=>number)):AxisForce<N>;
  export function forceY<N extends SimulationNode>(position:number|((node:N)=>number)):AxisForce<N>;
  export function forceZ<N extends SimulationNode>(position:number|((node:N)=>number)):AxisForce<N>;
}
declare module '*?worker' {const source:string;export default source;}
