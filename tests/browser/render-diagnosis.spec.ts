import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test.use({video:'off'});
test('Isolate current compositor, effect, geometry and empty framebuffer with fresh contexts @diagnostic',async({browser},info)=>{
  test.setTimeout(300000);const records=[];
  for(const name of ['product','no-bloom','no-background','no-background-or-bloom','no-aura','no-dom']){
    const context=await browser.newContext({viewport:{width:1560,height:1120}});
    const page=await context.newPage();await page.goto('http://127.0.0.1:4173/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();await page.waitForFunction(()=>!!(document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene?.debug().spiderLoaded);
    await page.evaluate(name=>{const shadow=document.querySelector('#app')!.shadowRoot!,scene=(shadow.querySelector('canvas') as any).__cosmosScene;
      if(name==='no-bloom'||name==='no-background-or-bloom')scene.bloomPass.enabled=false;
      if(name.startsWith('no-background'))scene.settings={...scene.settings,background:false};
      if(name==='no-aura')scene.auraBatch.visible=false;
      if(name==='no-dom'){for(const element of shadow.querySelectorAll<HTMLElement>('.cosmos-root>*'))if(!element.classList.contains('cosmos-scene'))element.style.setProperty('display','none','important');scene.labelRenderer.domElement.style.display='none';}
      scene.backdropDirty=true;scene.bloomDirty=true;
    },name);
    await page.waitForTimeout(2000);const sample=()=>page.evaluate(()=>{const canvas=document.querySelector('#app')!.shadowRoot!.querySelector('canvas')!,scene=(canvas as any).__cosmosScene,debug=scene.debug();return {at:performance.now(),frames:debug.frames,drawCalls:debug.drawCalls,triangles:debug.triangles,costs:debug.frameCosts,worker:debug.worker,renderFailed:debug.renderFailed,context:canvas.getContext('webgl2')!.getContextAttributes()};});
    const start=await sample();await page.waitForTimeout(12000);const end=await sample(),record={name,fps:(end.frames-start.frames)/((end.at-start.at)/1000),start,end};records.push(record);console.log('RENDER-VARIANT',JSON.stringify({name,fps:record.fps,drawCalls:end.drawCalls,triangles:end.triangles,failed:end.renderFailed,context:end.context}));await context.close();
  }
  await writeFile(info.outputPath('render-diagnosis.json'),JSON.stringify(records,null,2));
});
