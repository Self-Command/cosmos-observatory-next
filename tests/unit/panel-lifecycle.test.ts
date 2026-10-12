import { beforeEach, describe, expect, it, vi } from 'vitest';
const runtime=vi.hoisted(()=>({instances:[] as any[],start:()=>Promise.resolve(),close:()=>Promise.resolve()}));
vi.mock('obsidian',()=>({FileSystemAdapter:class {getBasePath(){return '/synthetic-vault';}}}));
vi.mock('../../src/framework/cosmograph/obsidian/plugin',()=>({default:class {constructor(readonly app:any,readonly manifest:any){}async onload(){}}}));
vi.mock('../../src/host/Coordinator',()=>({Coordinator:class {stopped=false;start=vi.fn(()=>runtime.start());destroy=vi.fn(()=>{this.stopped=true;return runtime.close();});constructor(){runtime.instances.push(this);}}}));
import { FileSystemAdapter } from 'obsidian';
import ObservatoryPlugin from '../../src/main';
function deferred(){let resolve!:()=>void;const promise=new Promise<void>(done=>{resolve=done;});return {promise,resolve};}
function plugin(){return new ObservatoryPlugin({vault:{adapter:new FileSystemAdapter(),configDir:'.obsidian'}} as any,{id:'cosmos-observatory-next'} as any);}
beforeEach(()=>{runtime.instances=[];runtime.start=()=>Promise.resolve();runtime.close=()=>Promise.resolve();});
describe('Panel-owned observation',()=>{
  it('enables without starting a scanner and shares it until the final panel closes',async()=>{
    const p=plugin();await p.onload();expect(runtime.instances).toHaveLength(0);
    const first={},second={};const c=await p.acquireCoordinator(first);expect(await p.acquireCoordinator(second)).toBe(c);expect(runtime.instances).toHaveLength(1);
    await p.releaseCoordinator(first);expect(runtime.instances[0].destroy).not.toHaveBeenCalled();await p.releaseCoordinator(second);expect(runtime.instances[0].destroy).toHaveBeenCalledOnce();
    await p.releaseCoordinator(second);expect(runtime.instances[0].destroy).toHaveBeenCalledOnce();
  });
  it('does not start when a panel closes before acquisition resumes',async()=>{
    const p=plugin();await p.onload();const owner={};const opening=p.acquireCoordinator(owner);const rejected=expect(opening).rejects.toThrow('已经关闭');await p.releaseCoordinator(owner);await rejected;expect(runtime.instances).toHaveLength(0);
  });
  it('stops a panel closed during initialization and serializes reopening after teardown',async()=>{
    const loading=deferred(),closing=deferred();runtime.start=()=>loading.promise;runtime.close=()=>closing.promise;
    const p=plugin();await p.onload();const first={},second={};const opening=p.acquireCoordinator(first);await vi.waitFor(()=>expect(runtime.instances).toHaveLength(1));
    const release=p.releaseCoordinator(first);expect(runtime.instances[0].stopped).toBe(true);const reopened=p.acquireCoordinator(second);await Promise.resolve();expect(runtime.instances).toHaveLength(1);
    loading.resolve();await opening;runtime.start=()=>Promise.resolve();runtime.close=()=>Promise.resolve();closing.resolve();await release;expect(await reopened).toBe(runtime.instances[1]);expect(runtime.instances).toHaveLength(2);await p.releaseCoordinator(second);
  });
  it('prevents a pending acquisition from restarting after plugin unload',async()=>{
    const p=plugin();await p.onload();const opening=p.acquireCoordinator({});const rejected=expect(opening).rejects.toThrow('已经关闭');p.onunload();await rejected;expect(runtime.instances).toHaveLength(0);
  });
});
