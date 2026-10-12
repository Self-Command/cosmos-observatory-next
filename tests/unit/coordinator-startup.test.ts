import {afterEach,beforeEach,describe,expect,it,vi} from 'vitest';
import {mkdtemp,rm} from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
const runtime=vi.hoisted(()=>({histories:[] as any[],load:()=>Promise.resolve({state:{},snapshots:[]})}));
vi.mock('obsidian',()=>({TFile:class {}}));
vi.mock('../../src/history/store',()=>({HistoryStore:class {save=vi.fn(async()=>{});flush=vi.fn(async()=>{});load=()=>runtime.load();constructor(){runtime.histories.push(this);}}}));
import {Coordinator} from '../../src/host/Coordinator';
import {migrateState} from '../../src/core/layout';
const directories:string[]=[];
beforeEach(()=>{runtime.histories=[];});
afterEach(async()=>{for(const directory of directories.splice(0))await rm(directory,{recursive:true,force:true});});
describe('Coordinator initialization cancellation',()=>{
  it('keeps saved layouts intact when the last panel closes while history is loading',async()=>{
    const directory=await mkdtemp(path.join(tmpdir(),'cosmos-panel-startup-'));directories.push(directory);let finish!:()=>void;
    const saved=migrateState(null);saved.worlds.world={position:[9,4,-7],rotation:[.2,.4,.6],locked:true};
    runtime.load=()=>new Promise(resolve=>{finish=()=>resolve({state:saved,snapshots:[]});});
    const scan=vi.fn(),read=vi.fn(),listen=vi.fn();const c=new Coordinator({vault:{getAllLoadedFiles:scan,read,adapter:{read},on:listen},metadataCache:{on:listen}} as any,directory);
    const opening=c.start();await vi.waitFor(()=>expect(runtime.histories).toHaveLength(1));const closing=c.destroy();finish();await opening;await closing;
    expect(runtime.histories[0].save).not.toHaveBeenCalled();expect(runtime.histories[0].flush).toHaveBeenCalledOnce();expect(scan).not.toHaveBeenCalled();expect(read).not.toHaveBeenCalled();expect(listen).not.toHaveBeenCalled();expect(saved.worlds.world.position).toEqual([9,4,-7]);
  });
});
