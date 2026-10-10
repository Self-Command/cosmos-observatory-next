import { describe,it,expect,vi } from 'vitest';
import { Patrol } from '../../src/core/patrol';
import { defaults } from '../../src/core/settings';
import type { FileDescriptor,InspectionResult } from '../../src/core/types';
const file:FileDescriptor={id:'a',path:'A/a.js',name:'a.js',worldId:'A',extension:'js',version:'1',size:20,cacheReady:true};
describe('Evidence-driven patrol',()=>{
  it('actually reads once, reports a parser error, and discards old versions',async()=>{let current={...file},reads=0;const results:InspectionResult[]=[];let finish:(text:string)=>void=()=>{};const patrol=new Patrol({files:()=>[current],current:()=>current,relations:()=>[],read:()=>{reads++;return new Promise(resolve=>{finish=resolve;});},unresolved:()=>[],hash:async()=> 'hash',result:r=>results.push(r),state:()=>{}},defaults());patrol.changed(current);await vi.waitFor(()=>expect(reads).toBe(1));current={...current,version:'2'};finish('const = ;');await new Promise(resolve=>setTimeout(resolve,20));expect(results).toHaveLength(0);patrol.changed(current);await vi.waitFor(()=>expect(reads).toBe(2));finish('const = ;');await vi.waitFor(()=>expect(results).toHaveLength(1));expect(results[0].version).toBe('2');expect(results[0].issues[0].rule).toBe('javascript.syntax');patrol.destroy();});
  it('suspension and history state do not produce extra checks',async()=>{let reads=0;const patrol=new Patrol({files:()=>[file],current:()=>file,relations:()=>[],read:async()=>{reads++;return 'const a=1';},unresolved:()=>[],hash:async()=> 'hash',result:()=>{},state:()=>{}},{...defaults(),patrolPaused:true});patrol.start();patrol.changed(file);await new Promise(resolve=>setTimeout(resolve,20));expect(reads).toBe(0);patrol.destroy();});
});
