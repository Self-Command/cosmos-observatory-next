import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test('10000 files, 5000 events and ten-minute bounded 3D operation',async({page},info)=>{
  test.setTimeout(780000);const errors:string[]=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto('/');await page.evaluate(async()=>{await (window as any).fixture.seedStress();});
  await expect(page.getByText('10000 文件',{exact:true})).toBeVisible({timeout:60000});
  await expect.poll(()=>page.evaluate(()=>((document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene.debug().positions.length)),{timeout:60000}).toBe(1400);
  const sample=()=>page.evaluate(()=>{const fixture=(window as any).fixture,scene=(document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene;const d=scene.debug();return {at:Date.now(),frames:d.frames,geometries:d.geometries,visible:d.positions.length,worlds:d.worlds.length,events:fixture.snapshot.events.length,completed:fixture.snapshot.patrol.completed,heap:(performance as any).memory?.usedJSHeapSize??0};});
  const start=await sample(),samples=[start];expect(start.visible).toBeLessThanOrEqual(1400);expect(start.worlds).toBe(7);
  for(let i=0;i<20;i++){await page.waitForTimeout(30000);await page.evaluate(async index=>{await (window as any).fixture.modify(`太阳/压力-${index*7}.md`,`# changed ${index}\n`);},i);samples.push(await sample());expect(samples.at(-1)!.frames).toBeGreaterThan(samples.at(-2)!.frames);expect(samples.at(-1)!.visible).toBeLessThanOrEqual(1400);expect(samples.at(-1)!.events).toBeLessThanOrEqual(5000);}
  expect(samples.at(-1)!.at-start.at).toBeGreaterThanOrEqual(600000);expect(samples.at(-1)!.completed).toBeGreaterThan(start.completed);expect(samples.at(-1)!.geometries).toBeLessThan(start.geometries+100);expect(errors).toEqual([]);
  await page.evaluate(async()=>{const fixture=(window as any).fixture;await fixture.saveSnapshot();fixture.replay(fixture.historySnapshots().length-1);});
  const evidence=JSON.stringify({renderer:'SwiftShader / Chromium',configuration:{files:10000,eventLimit:5000,nodeBudget:1400,pixelRatio:1.5,fpsLimit:40},samples,errors},null,2);await writeFile(info.outputPath('endurance.json'),evidence);await info.attach('endurance.json',{body:evidence,contentType:'application/json'});
  await page.screenshot({path:info.outputPath('dense-universe.png')});
});
