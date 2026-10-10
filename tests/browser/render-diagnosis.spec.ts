import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test.use({video:'off'});
test('Isolate current compositor, effect, geometry and empty framebuffer with fresh contexts @diagnostic',async({browser},info)=>{
  test.setTimeout(300000);const records=[];
  for(const name of ['product','opaque-product','opaque-no-bloom','opaque-gpu-bloom','opaque-svg-gpu-bloom','opaque-svg-no-bloom']){
    const context=await browser.newContext({viewport:{width:1560,height:1120}});if(name.startsWith('opaque'))await context.addInitScript(()=>{const prototype=HTMLCanvasElement.prototype as any,original=prototype.getContext;prototype.getContext=function(this:HTMLCanvasElement,type:string,attributes?:any){return original.call(this,type,type==='webgl2'?{...attributes,alpha:false,antialias:false}:attributes);};});
    const page=await context.newPage();await page.goto('http://127.0.0.1:4173/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();await page.waitForFunction(()=>!!(document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene?.debug().spiderLoaded);
    await page.evaluate(async name=>{const shadow=document.querySelector('#app')!.shadowRoot!,scene=(shadow.querySelector('canvas') as any).__cosmosScene;
      if(name.includes('no-bloom')){scene.bloomPass.enabled=false;scene.bloomCanvas.style.display='none';}
      if(name.includes('gpu-bloom')){scene.bloomCanvas.style.display='none';scene.presentBloom=()=>{};const render=scene.renderFrame.bind(scene);scene.renderFrame=()=>{render();scene.renderer.autoClear=false;scene.bloomOverlay.render(scene.renderer);scene.renderer.autoClear=true;};}
      if(name.includes('svg')){const img=new Image();img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(shadow.querySelector('.reference-space svg')!.outerHTML);await img.decode();const texture=scene.glowTexture.clone();texture.image=img;texture.colorSpace='srgb';texture.needsUpdate=true;scene.scene.background=texture;}
      if(name==='hidden-bloom-layer')scene.bloomCanvas.style.display='none';if(name==='normal-bloom-blend')scene.bloomCanvas.style.mixBlendMode='normal';
      if(['no-bloom','only-main-geometry','empty-framebuffer','opaque-main-geometry'].includes(name)){scene.bloomPass.enabled=false;scene.bloomCanvas.style.display='none';}
      if(['only-main-geometry','empty-framebuffer','opaque-main-geometry'].includes(name)){for(const element of shadow.querySelectorAll<HTMLElement>('.cosmos-root>*'))if(!element.classList.contains('cosmos-scene'))element.style.display='none';scene.labelRenderer.domElement.style.display='none';}
      if(name==='empty-framebuffer'){for(const object of scene.scene.children)object.visible=false;scene.update=()=>{};}
    },name);
    await page.waitForTimeout(2000);const sample=()=>page.evaluate(()=>{const canvas=document.querySelector('#app')!.shadowRoot!.querySelector('canvas')!,scene=(canvas as any).__cosmosScene,debug=scene.debug();return {at:performance.now(),frames:debug.frames,drawCalls:debug.drawCalls,triangles:debug.triangles,costs:debug.frameCosts,worker:debug.worker,renderFailed:debug.renderFailed,context:canvas.getContext('webgl2')!.getContextAttributes()};});
    const start=await sample();await page.waitForTimeout(12000);const end=await sample(),record={name,fps:(end.frames-start.frames)/((end.at-start.at)/1000),start,end};records.push(record);console.log('RENDER-VARIANT',JSON.stringify({name,fps:record.fps,drawCalls:end.drawCalls,triangles:end.triangles,failed:end.renderFailed,context:end.context}));await context.close();
  }
  await writeFile(info.outputPath('render-diagnosis.json'),JSON.stringify(records,null,2));
});
