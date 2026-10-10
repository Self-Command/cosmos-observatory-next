import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test.use({video:'off'});
test('Isolate render scheduling, backing buffers and raw WebGL presentation',async({page},info)=>{
  test.setTimeout(180000);await page.goto('/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();
  const metrics=await page.evaluate(async()=>{
    const shadow=document.querySelector('#app')!.shadowRoot!,canvas=shadow.querySelector('canvas')!,scene=(canvas as any).__cosmosScene,gl=canvas.getContext('webgl2')!;
    const sample=(name:string,raw=false)=>new Promise<any>(resolve=>{const start=performance.now(),initial=scene.debug().frames;let frames=0;const next=()=>{if(raw){gl.clearColor(.02,.03,.04,1);gl.clear(gl.COLOR_BUFFER_BIT);}frames++;if(performance.now()-start>=4000){const elapsed=(performance.now()-start)/1000,debug=scene.debug();resolve({name,rafFps:frames/elapsed,renderFps:(debug.frames-initial)/elapsed,buffer:{width:canvas.width,height:canvas.height,glWidth:gl.drawingBufferWidth,glHeight:gl.drawingBufferHeight},rect:canvas.getBoundingClientRect().toJSON(),context:gl.getContextAttributes(),drawCalls:debug.drawCalls,triangles:debug.triangles});}else requestAnimationFrame(next);};requestAnimationFrame(next);});
    const records=[await sample('product-default')];
    scene.labelRenderer.render=()=>{};records.push(await sample('without-css-label-render'));
    scene.updateInstances=()=>{};records.push(await sample('without-instance-updates'));
    scene.callbacks.positions=()=>{};records.push(await sample('without-position-recording'));
    (window as any).fixture.destroy();scene.physics.pause(true,25);records.push(await sample('without-coordinator-and-physics'));
    for(const object of scene.scene.children)object.visible=false;scene.scene.background=null;scene.composer.render=()=>scene.renderer.render(scene.scene,scene.camera);records.push(await sample('empty-three-scene'));
    for(const child of shadow.querySelectorAll<HTMLElement>('.cosmos-root>*,.cosmos-portal'))if(!child.classList.contains('cosmos-scene'))child.style.display='none';records.push(await sample('only-canvas'));
    cancelAnimationFrame(scene.tickFrame);records.push(await sample('raw-existing-webgl',true));
    scene.destroy();const plain=document.createElement('canvas');plain.width=1560;plain.height=1120;plain.style.cssText='position:fixed;inset:0;width:1560px;height:1120px;';document.body.append(plain);const context=plain.getContext('webgl2',{antialias:true})!;const start=performance.now();let frames=0;const plainFps=await new Promise<number>(resolve=>{const frame=()=>{context.clearColor(.02,.03,.04,1);context.clear(context.COLOR_BUFFER_BIT);frames++;if(performance.now()-start>=4000)resolve(frames/((performance.now()-start)/1000));else requestAnimationFrame(frame);};requestAnimationFrame(frame);});records.push({name:'fresh-document-webgl',rafFps:plainFps,context:context.getContextAttributes()});context.getExtension('WEBGL_lose_context')?.loseContext();plain.remove();return records;
  });
  console.log('RENDER-DIAGNOSIS',JSON.stringify(metrics));await writeFile(info.outputPath('render-diagnosis.json'),JSON.stringify(metrics,null,2));
});
