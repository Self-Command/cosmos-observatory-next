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

test('Trace software rendering and compositor work @diagnostic',async({page,browser},info)=>{
  test.setTimeout(120000);await page.goto('/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();await page.evaluate(async()=>{await (window as any).fixture.seedStress();});await page.waitForTimeout(10000);
  const cdp=await browser.newBrowserCDPSession(),before=await cdp.send('SystemInfo.getProcessInfo'),events:any[]=[];cdp.on('Tracing.dataCollected',event=>events.push(...event.value));
  await cdp.send('Tracing.start',{categories:'gpu,cc,viz,renderer,blink,disabled-by-default-gpu.service',transferMode:'ReportEvents'});await page.waitForTimeout(6000);const complete=new Promise<void>(resolve=>cdp.once('Tracing.tracingComplete',()=>resolve()));await cdp.send('Tracing.end');await complete;const after=await cdp.send('SystemInfo.getProcessInfo');
  const groups=new Map<string,{duration:number;count:number;max:number}>();for(const event of events)if(event.ph==='X'&&event.dur>0&&event.dur<6000000){const key=`${event.pid}:${event.tid} ${event.name}`,group=groups.get(key)??{duration:0,count:0,max:0};group.duration+=event.dur/1000;group.count++;group.max=Math.max(group.max,event.dur/1000);groups.set(key,group);}
  const top=[...groups].map(([name,group])=>({name,...group})).sort((a,b)=>b.duration-a.duration).slice(0,40),cpu=after.processInfo.map(process=>({type:process.type,id:process.id,cpuSeconds:process.cpuTime-(before.processInfo.find(old=>old.id===process.id)?.cpuTime??process.cpuTime)}));console.log('GPU-TRACE-TOP',JSON.stringify({top,cpu}));await writeFile(info.outputPath('software-render-trace.json'),JSON.stringify({traceEvents:events}));await cdp.detach();
});

test('Measure completed GPU work per visible draw @diagnostic',async({page},info)=>{
  test.setTimeout(120000);await page.goto('/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();await page.evaluate(async()=>{await (window as any).fixture.seedStress();});await page.waitForTimeout(10000);
  const measurements=await page.evaluate(async()=>{
    const shadow=document.querySelector('#app')!.shadowRoot!,scene=(shadow.querySelector('canvas') as any).__cosmosScene,gl=scene.renderer.getContext(),records:Record<string,number[]>={};
    const names=new Map<any,string>([[scene.coreBatch,'core'],[scene.glowBatch,'glow'],[scene.auraBatch,'aura'],[scene.anchorBatch,'anchor'],[scene.thinEdges,'edges'],[scene.auxiliaryLines,'auxiliary']]);
    const objects:any[]=[];scene.scene.traverse((object:any)=>{if(object.isMesh||object.isLine)objects.push(object);});
    const previous=objects.map(object=>({object,before:object.onBeforeRender,after:object.onAfterRender}));
    for(const {object,before,after} of previous){let started=0;object.onBeforeRender=(...args:any[])=>{before.apply(object,args);gl.finish();started=performance.now();};object.onAfterRender=(...args:any[])=>{gl.finish();const key=names.get(object)??(object.isSkinnedMesh?'spider':'other');(records[key]??=[]).push(performance.now()-started);after.apply(object,args);};}
    await new Promise(resolve=>setTimeout(resolve,6000));for(const {object,before,after} of previous){object.onBeforeRender=before;object.onAfterRender=after;}
    const costs=Object.fromEntries(Object.entries(records).map(([key,values])=>[key,{count:values.length,mean:values.reduce((a,b)=>a+b,0)/values.length,max:Math.max(...values)}]));
    scene.physics.pause(true,25);const sample=async()=>{const at=performance.now(),frames=scene.debug().frames;await new Promise(resolve=>setTimeout(resolve,6000));return (scene.debug().frames-frames)/((performance.now()-at)/1000);};const noPhysics=await sample();for(const element of shadow.querySelectorAll<HTMLElement>('.cosmos-root>*'))if(!element.classList.contains('cosmos-scene'))element.style.display='none';scene.labelRenderer.domElement.style.display='none';const noPhysicsOrDom=await sample();return {costs,noPhysics,noPhysicsOrDom};
  });console.log('COMPLETED-GPU-COSTS',JSON.stringify(measurements));await writeFile(info.outputPath('completed-gpu-costs.json'),JSON.stringify(measurements,null,2));
});
