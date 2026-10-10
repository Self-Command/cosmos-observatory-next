import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
test.use({video:'off'});
test('Isolate stress rendering costs in the same warmed context @diagnostic',async({page},info)=>{
  test.setTimeout(300000);await page.goto('/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();await page.waitForTimeout(12000);
  await page.evaluate(async()=>{await (window as any).fixture.seedStress();});await expect(page.getByText('10000 文件',{exact:true})).toBeVisible();await page.waitForTimeout(12000);
  await page.evaluate(()=>{const scene=(document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene,original=scene.renderFrame.bind(scene);scene.diagnosticVariant='product';scene.renderFrame=()=>{const variant=scene.diagnosticVariant,objects=variant==='no-core'?[scene.coreBatch,scene.distantCoreBatch]:variant==='no-glow'?[scene.glowBatch]:variant==='no-edges'?[scene.edgeLines,scene.thinEdges]:variant==='no-aura'?[scene.auraBatch]:variant==='no-spider'?[scene.spider]:variant==='no-auxiliary'?[scene.auxiliaryLines]:[];const previous=objects.map(object=>object?.visible),bloom=scene.bloomPass.enabled;objects.forEach(object=>{if(object)object.visible=false;});if(variant==='no-bloom')scene.bloomPass.enabled=false;try{original();}finally{objects.forEach((object,index)=>{if(object)object.visible=previous[index];});scene.bloomPass.enabled=bloom;}};});
  const records=[];
  for(const name of ['product','no-core','no-glow','no-edges','no-aura','no-spider','no-auxiliary','no-bloom','no-dom']){
    await page.evaluate(name=>{const shadow=document.querySelector('#app')!.shadowRoot!,scene=(shadow.querySelector('canvas') as any).__cosmosScene;scene.diagnosticVariant=name;for(const element of shadow.querySelectorAll<HTMLElement>('.cosmos-root>*'))if(!element.classList.contains('cosmos-scene'))element.style.display=name==='no-dom'?'none':'';scene.labelRenderer.domElement.style.display=name==='no-dom'?'none':'';scene.backdropDirty=true;scene.bloomDirty=true;},name);
    await page.waitForTimeout(1000);const sample=()=>page.evaluate(()=>{const scene=(document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene,debug=scene.debug();return {at:performance.now(),frames:debug.frames,drawCalls:debug.drawCalls,triangles:debug.triangles,lod:debug.levelOfDetail,costs:debug.frameCosts,worker:debug.worker,renderFailed:debug.renderFailed};});
    const start=await sample();await page.waitForTimeout(12000);const end=await sample(),record={name,fps:(end.frames-start.frames)/((end.at-start.at)/1000),start,end};records.push(record);console.log('RENDER-VARIANT',JSON.stringify({name,fps:record.fps,lod:end.lod,drawCalls:end.drawCalls,triangles:end.triangles,failed:end.renderFailed}));
  }
  await writeFile(info.outputPath('render-diagnosis.json'),JSON.stringify(records,null,2));
});
