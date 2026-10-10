import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test.use({video:'off'});
test('Isolate framebuffer transparency and bloom with fresh contexts @diagnostic',async({browser},info)=>{
  test.setTimeout(300000);const records=[];
  for(const name of ['alpha-default','opaque-default','opaque-direct','alpha-direct','opaque-empty','alpha-empty']){
    const context=await browser.newContext({viewport:{width:1560,height:1120}});await context.addInitScript(opaque=>{const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(type:string,attributes?:any){return original.call(this,type as any,type==='webgl2'?{...attributes,alpha:!opaque}:attributes);};},name.startsWith('opaque'));
    const page=await context.newPage();await page.goto('http://127.0.0.1:4173/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();await page.waitForFunction(()=>!!(document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene?.debug().spiderLoaded);
    await page.evaluate(name=>{const scene=(document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene;if(name.includes('direct')||name.includes('empty'))scene.renderFrame=()=>{if(name.includes('empty'))for(const object of scene.scene.children)object.visible=false;scene.renderer.info.reset();scene.renderer.setRenderTarget(null);scene.renderer.render(scene.scene,scene.camera);};},name);
    await page.waitForTimeout(2000);const sample=()=>page.evaluate(()=>{const canvas=document.querySelector('#app')!.shadowRoot!.querySelector('canvas')!,scene=(canvas as any).__cosmosScene,debug=scene.debug();return {at:performance.now(),frames:debug.frames,drawCalls:debug.drawCalls,triangles:debug.triangles,costs:debug.frameCosts,worker:debug.worker,context:canvas.getContext('webgl2')!.getContextAttributes()};});
    const start=await sample();await page.waitForTimeout(15000);const end=await sample(),record={name,fps:(end.frames-start.frames)/((end.at-start.at)/1000),start,end};records.push(record);console.log('RENDER-VARIANT',JSON.stringify({name,fps:record.fps,drawCalls:end.drawCalls,triangles:end.triangles,context:end.context}));await context.close();
  }
  await writeFile(info.outputPath('render-diagnosis.json'),JSON.stringify(records,null,2));
});
