import {describe,it,expect} from 'vitest';
import {parseConfiguration,validWorld,validPanel} from '../../src/core/layout';
import {dependencyRelations} from '../../src/core/dependencies';
import type {FileDescriptor,InspectionResult} from '../../src/core/types';
import path from 'node:path';
describe('Configurable layouts and actual dependency evidence',()=>{
  it('validates three axes, rejects malformed layouts and never imports credentials',()=>{expect(validWorld({position:[1,2,3],rotation:[.1,.2,.3],locked:false})).toBe(true);expect(validWorld({position:[1,2],rotation:[0,0,0],locked:false})).toBe(false);expect(validPanel({x:0,y:100,width:240,height:160,z:1,visible:true,locked:false,maximized:false})).toBe(true);expect(()=>parseConfiguration('{"version":1,"settings":{},"worlds":{"a":{"position":null}}}')).toThrow();const result=parseConfiguration('{"version":1,"settings":{},"token":"must not import"}');expect(result).not.toHaveProperty('token');});
  it('resolves only present relative modules with matching checked version',()=>{const files:FileDescriptor[]=[{id:'a',path:'A/a.ts',name:'a.ts',worldId:'A',extension:'ts',version:'1',size:1,cacheReady:true},{id:'b',path:'A/b.ts',name:'b.ts',worldId:'A',extension:'ts',version:'1',size:1,cacheReady:true}];const result:InspectionResult={fileId:'a',path:'A/a.ts',version:'1',hash:'hash',checkedAt:1,status:'pass',rules:[],issues:[],unassessed:[],dependencies:['./b','package','./missing']};expect(dependencyRelations(files,{a:result},path.posix.normalize)).toHaveLength(1);expect(dependencyRelations(files,{a:{...result,version:'old'}},path.posix.normalize)).toHaveLength(0);});
});
