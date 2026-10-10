import { browser } from '@wdio/globals';import assert from 'node:assert/strict';import { mkdir,writeFile } from 'node:fs/promises';
describe('Real Obsidian native plugin',()=>{
  it('loads, scans actual files, discovers folders and reports real syntax evidence',async()=>{
    await browser.executeObsidianCommand('cosmos-observatory-next:open-3d-knowledge-graph');await browser.waitUntil(async()=>browser.execute(()=>{const host=document.querySelector('.cosmos-shadow-host');return !!host?.shadowRoot?.querySelector('.cosmos-root');}),{timeout:60000});
    const info=await browser.execute(()=>({versions:process.versions,obsidian:app.version}));await mkdir('test-results/host',{recursive:true});await writeFile('test-results/host/runtime.json',JSON.stringify(info,null,2));
    await browser.waitUntil(async()=>browser.execute(()=>app.plugins.plugins['cosmos-observatory-next'].coordinator.snapshot.model.status==='ready'),{timeout:30000,timeoutMsg:'Native metadata cache never became ready for business checks'});
    const initial=await browser.execute(async()=>{const plugin=app.plugins.plugins['cosmos-observatory-next'];return plugin.coordinator.snapshot;});assert.ok(initial.worlds.length>=7);assert.ok(initial.files.length>=20);assert.equal(initial.model.status,'ready');
    await browser.execute(async()=>{await app.vault.createFolder('新测试世界');await app.vault.create('新测试世界/error.js','const = ;');});
    await browser.waitUntil(async()=>browser.execute(()=>{const snapshot=app.plugins.plugins['cosmos-observatory-next'].coordinator.snapshot;const file=snapshot.files.find(f=>f.path==='新测试世界/error.js');return file&&snapshot.results[file.id]?.status==='issues';}),{timeout:30000});
    await browser.execute(async()=>{const file=app.vault.getAbstractFileByPath('新测试世界/error.js');await app.vault.modify(file,'const fixed = 1;');});
    await browser.waitUntil(async()=>browser.execute(()=>{const snapshot=app.plugins.plugins['cosmos-observatory-next'].coordinator.snapshot;const file=snapshot.files.find(f=>f.path==='新测试世界/error.js');return file&&snapshot.results[file.id]?.status==='pass';}),{timeout:30000});
    await browser.waitUntil(async()=>browser.execute(()=>document.querySelector('.cosmos-shadow-host').shadowRoot.querySelector('canvas').__cosmosScene.debug().spiderLoaded),{timeout:30000,timeoutMsg:'Real host spider GLB did not load'});
    const debug=await browser.execute(()=>{const canvas=document.querySelector('.cosmos-shadow-host').shadowRoot.querySelector('canvas');return canvas.__cosmosScene.debug();});assert.ok(debug.positions.every(p=>p.geometry==='SphereGeometry'));assert.ok(debug.worlds.length>=8);assert.equal(debug.renderer,'CosmoGraph.SphericalGraph');await browser.saveScreenshot('test-results/host/native.png');
    await browser.execute(async()=>{const plugin=app.plugins.plugins['cosmos-observatory-next'];await plugin.coordinator.updateSettings({patrolPaused:true});for(const leaf of app.workspace.getLeavesOfType('cosmos-observatory-next-view'))leaf.detach();});
  });
});
