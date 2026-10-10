import { test,expect } from '@playwright/test';
test('Real 3D folders, independent transforms, shadcn panels and real parser spider',async({page},testInfo)=>{
  const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));await page.goto('/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();
  await expect(page.locator('canvas').first()).toBeVisible();await expect.poll(()=>page.evaluate(()=>{const canvas=document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any;return canvas.__cosmosScene?.debug().spiderLoaded;})).toBe(true);
  const initial=await page.evaluate(()=>((document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene.debug()));expect(initial.positions.length).toBe(630);expect(initial.positions.every((p:any)=>p.geometry==='SphereGeometry')).toBe(true);expect(new Set(initial.positions.map((p:any)=>Math.round(p.local[2]*100))).size).toBeGreaterThan(10);expect(initial.edgeVertices).toBeGreaterThan(0);
  await expect.poll(()=>page.locator('.graph-label:visible').count()).toBeLessThan(28);
  const panelBox=await page.locator('[data-panel=events]').boundingBox();expect(panelBox?.width).toBeCloseTo(244,0);expect(panelBox?.height).toBeCloseTo(142,0);expect(panelBox?.x).toBeCloseTo(28,0);expect(panelBox?.y).toBeCloseTo(940,0);
  await page.screenshot({path:testInfo.outputPath('default-universe.png')});
  await page.getByRole('button',{name:'打开设置'}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.getByRole('tab',{name:'独立世界',exact:true}).click();const earth=await page.evaluate(()=>{const fixture=(window as any).fixture;return fixture.snapshot.worlds.find((w:any)=>w.name==='地球').id;});await page.getByLabel('地球 position X').fill('8');await page.getByRole('button',{name:'Close',exact:true}).click();await expect.poll(()=>page.evaluate(id=>(window as any).fixture.state.worlds[id].position[0],earth)).toBe(8);
  await page.getByRole('button',{name:'排版 关闭',exact:true}).click();await page.evaluate(id=>{const scene=(document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene;scene.selectWorld(id);},earth);
  await page.evaluate(async()=>{await (window as any).fixture.updateSettings({animationPaused:true});});
  const beforeMove=await page.evaluate(()=>((document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene.debug()));const earthBefore=beforeMove.worlds.find((w:any)=>w.id===earth);await page.mouse.move(earthBefore.screen.x,earthBefore.screen.y);await page.mouse.down();await page.mouse.move(earthBefore.screen.x+70,earthBefore.screen.y-30,{steps:20});await page.mouse.up();
  await expect.poll(()=>page.evaluate(id=>JSON.stringify((window as any).fixture.state.worlds[id].position),earth)).not.toBe(JSON.stringify(earthBefore.position));
  const afterMove=await page.evaluate(()=>((document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene.debug()));expect(afterMove.positions.map((p:any)=>p.local)).toEqual(beforeMove.positions.map((p:any)=>p.local));expect(afterMove.worlds.filter((w:any)=>w.id!==earth).map((w:any)=>w.position)).toEqual(beforeMove.worlds.filter((w:any)=>w.id!==earth).map((w:any)=>w.position));
  await page.getByLabel('搜索文件').fill('月亮/文件-10');await page.getByRole('button',{name:'月亮/文件-10.md',exact:true}).click();await expect(page.getByRole('button',{name:'打开 文件-10.md',exact:true})).toBeVisible();await page.getByRole('button',{name:'打开 文件-10.md',exact:true}).click();expect(await page.evaluate(()=>(window as any).lastOpened)).toBe('月亮/文件-10.md');await page.getByLabel('搜索文件').fill('');
  const panel=page.locator('[data-panel=events]');const before=await panel.boundingBox();await panel.locator('[data-slot=card-title]').dragTo(page.locator('[data-panel=checks] [data-slot=card-title]'));const after=await panel.boundingBox();expect(after?.x!==before?.x||after?.y!==before?.y).toBe(true);
  await page.evaluate(async()=>{await (window as any).fixture.add('新世界');await (window as any).fixture.add('新世界/error.js','const = ;');});await expect(page.getByText('8 世界',{exact:true})).toBeVisible();await expect.poll(()=>page.evaluate(()=>{const fixture=(window as any).fixture,file=fixture.snapshot.files.find((f:any)=>f.path==='新世界/error.js');return fixture.snapshot.results[file.id]?.status;})).toBe('issues');
  await page.evaluate(async()=>{await (window as any).fixture.modify('新世界/error.js','const repaired = 1;');});await expect.poll(()=>page.evaluate(()=>{const fixture=(window as any).fixture,file=fixture.snapshot.files.find((f:any)=>f.path==='新世界/error.js');return fixture.snapshot.results[file.id]?.status;})).toBe('pass');
  await page.screenshot({path:testInfo.outputPath('universe.png')});expect(errors).toEqual([]);
  const original=await (await page.request.get('/reference.svg')).text();await page.goto('about:blank');await page.setContent(`<html><body style="margin:0">${original}</body></html>`);await page.screenshot({path:testInfo.outputPath('original-svg.png')});
});

test('Panel resizing, locking, hiding and restoration preserve the 3D camera',async({page})=>{
  await page.goto('/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();
  await page.evaluate(async()=>{await (window as any).fixture.updateSettings({animationPaused:true,patrolPaused:true});});
  const panel=page.locator('[data-panel=events]'),camera=await page.evaluate(()=>((document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene.debug().camera));
  const original=(await panel.boundingBox())!;await page.mouse.move(original.x+original.width-2,original.y+original.height-2);await page.mouse.down();await page.mouse.move(original.x+original.width-26,original.y+original.height-20,{steps:15});await page.mouse.up();
  await expect.poll(async()=>Math.round((await panel.boundingBox())!.width)).toBeLessThan(Math.round(original.width)-10);
  const resized=(await panel.boundingBox())!;expect(resized.height).toBeLessThan(original.height-10);
  await page.getByRole('button',{name:'事件轨迹最大化',exact:true}).click();await expect.poll(async()=>(await panel.boundingBox())!.width).toBeGreaterThan(1500);
  await page.getByRole('button',{name:'事件轨迹最大化',exact:true}).click();const restored=(await panel.boundingBox())!;expect(restored).toEqual(resized);
  await page.getByRole('button',{name:'事件轨迹锁定',exact:true}).click();await panel.locator('[data-slot=card-title]').dragTo(page.locator('[data-panel=checks] [data-slot=card-title]'));expect(await panel.boundingBox()).toEqual(resized);
  await page.getByRole('button',{name:'事件轨迹隐藏',exact:true}).click();await expect(panel).toHaveCount(0);await page.getByRole('button',{name:'显示事件轨迹',exact:true}).click();expect(await panel.boundingBox()).toEqual(resized);
  await page.getByRole('button',{name:'打开设置',exact:true}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.querySelector('#app')!.shadowRoot!.activeElement?.closest('[role=dialog]'))).toBe(true);await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);
  expect(await page.evaluate(()=>((document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene.debug().camera))).toEqual(camera);
});

