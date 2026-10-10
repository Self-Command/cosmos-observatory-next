import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test.use({video:'off'});
test('Isolate GPU work with a new document and context for every render variant',async({page},info)=>{
  test.setTimeout(300000);const records=[];
  for(const name of ['default','byte-buffers','byte-buffers-without-background','direct-without-background','direct-without-background-without-aura','direct-without-background-without-lines']){
    await page.goto('/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();
    await page.waitForFunction(()=>!!(document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene?.debug().spiderLoaded);
    await page.evaluate(name=>{
      const shadow=document.querySelector('#app')!.shadowRoot!,scene=(shadow.querySelector('canvas') as any).__cosmosScene;
      if(name.includes('byte'))for(const target of [scene.composer.renderTarget1,scene.composer.renderTarget2,scene.bloomPass.renderTargetBright,...scene.bloomPass.renderTargetsHorizontal,...scene.bloomPass.renderTargetsVertical]){target.texture.type=1009;target.dispose();}
      if(name.includes('direct-render'))scene.composer.render=()=>scene.renderer.render(scene.scene,scene.camera);
      if(name==='without-bloom')scene.bloomPass.enabled=false;
      if(name==='without-panel-backdrop')for(const panel of shadow.querySelectorAll<HTMLElement>('.observatory-panel'))panel.style.backdropFilter='none';
      if(name.includes('without-dom'))for(const child of shadow.querySelectorAll<HTMLElement>('.cosmos-root>*,.cosmos-portal'))if(!child.classList.contains('cosmos-scene'))child.style.display='none';
      const render=scene.composer.render.bind(scene.composer);scene.composer.render=()=>{if(name.includes('without-background'))scene.scene.background=null;if(name.includes('without-aura'))for(const world of scene.worlds.values())world.aura.visible=false;if(name.includes('without-lines')){scene.edgeLines.visible=false;for(const world of scene.worlds.values()){world.orbits.visible=false;world.structure.visible=false;}}if(name.includes('direct'))scene.renderer.render(scene.scene,scene.camera);else render();};
    },name);
    await page.waitForTimeout(2000);
    const sample=()=>page.evaluate(()=>{const canvas=document.querySelector('#app')!.shadowRoot!.querySelector('canvas')!,scene=(canvas as any).__cosmosScene;const debug=scene.debug();return {at:performance.now(),frames:debug.frames,drawCalls:debug.drawCalls,triangles:debug.triangles,costs:debug.frameCosts,context:canvas.getContext('webgl2')!.getContextAttributes()};});
    const start=await sample();await page.waitForTimeout(15000);const end=await sample(),record={name,fps:(end.frames-start.frames)/((end.at-start.at)/1000),start,end};records.push(record);console.log('RENDER-VARIANT',JSON.stringify({name,fps:record.fps,drawCalls:end.drawCalls,triangles:end.triangles}));
    await page.evaluate(()=>((document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene.destroy()));await page.goto('about:blank');
  }
  await writeFile(info.outputPath('render-diagnosis.json'),JSON.stringify(records,null,2));
});
