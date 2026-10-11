import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test.use({video:'off'});
test('Sphere detail preserves every visible file and restores a smooth selected sphere',async({page},info)=>{
  await page.goto('/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();
  const probe=()=>page.evaluate(()=>{const scene=(document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene;return {total:scene.order.length,near:scene.coreBatch.count,distant:scene.distantCoreBatch.count,meshes:[scene.coreBatch,scene.distantCoreBatch].map(mesh=>({type:mesh.geometry.type,segments:mesh.geometry.parameters.widthSegments,depthWrite:mesh.material.depthWrite,lights:mesh.material.lights,vertexRadii:Array.from({length:mesh.geometry.attributes.position.count},(_,index)=>{const positions=mesh.geometry.attributes.position;return Math.hypot(positions.getX(index),positions.getY(index),positions.getZ(index));})})),selected:scene.order.find((visual:any)=>visual.file.id===scene.showFileId)?.near,failed:scene.debug().renderFailed};});
  const before=await probe();expect(before.total).toBe(630);expect(before.near+before.distant).toBe(630);expect(before.distant).toBeGreaterThan(0);
  for(const mesh of before.meshes){expect(mesh.type).toBe('SphereGeometry');expect(mesh.depthWrite).toBe(true);expect(mesh.lights).toBe(true);for(const radius of mesh.vertexRadii)expect(radius).toBeCloseTo(1,5);}
  const target=await page.evaluate(()=>{const scene=(document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene;return scene.order.find((visual:any)=>!visual.near).file;});
  await page.getByLabel('搜索文件').fill(target.path);await page.getByRole('option',{name:target.path,exact:true}).click();
  await expect.poll(async()=>{const value=await probe();return value.selected;}).toBe(true);const selected=await probe();expect(selected.near+selected.distant).toBe(630);expect(selected.meshes[0].segments).toBeGreaterThan(selected.meshes[1].segments);expect(selected.failed).toBe(false);
  await page.screenshot({path:info.outputPath('selected-sphere-detail.png')});await writeFile(info.outputPath('sphere-detail.json'),JSON.stringify({before,selected},null,2));
});

test('Root-only and empty file scopes keep a valid renderer and usable file list',async({page})=>{
  await page.goto('/?scope=root');
  await expect(page.getByText('1 文件',{exact:true})).toBeVisible();
  const state=()=>page.evaluate(()=>{const scene=(document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene;return {frames:scene.debug().frames,failed:scene.debug().renderFailed,files:scene.debug().positions.length};});
  await expect.poll(async()=>{const value=await state();return value.frames;}).toBeGreaterThan(0);expect(await state()).toMatchObject({failed:false,files:0});
  await page.getByRole('navigation',{name:'观测入口'}).getByRole('button',{name:'实体',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('根范围.md');await page.keyboard.press('Escape');
  await page.goto('/?scope=empty');await expect(page.getByText('0 文件',{exact:true})).toBeVisible();await expect.poll(async()=>{const value=await state();return value.frames;}).toBeGreaterThan(0);expect(await state()).toMatchObject({failed:false,files:0});
});
