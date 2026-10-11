import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

test.use({video:'off'});
test('Event bursts preserve panel paint, graph buffers and responsive coverage at default settings',async({page},info)=>{
  await page.goto('/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();
  await page.evaluate(async()=>{await (window as any).fixture.updateSettings({patrolPaused:true});});await page.waitForTimeout(1500);
  await page.evaluate(()=>{
    const shadow=document.querySelector('#app')!.shadowRoot!,canvas=shadow.querySelector('canvas') as any,scene=canvas.__cosmosScene;
    const backgrounds=[...shadow.querySelectorAll('[data-panel],.reference-space svg,.reference-chrome svg')];
    (window as any).paintProbe={backgrounds,changes:0,before:scene.getWork()};
    const observer=new MutationObserver(records=>{(window as any).paintProbe.changes+=records.length;});
    for(const element of shadow.querySelectorAll('.reference-space,.reference-chrome'))observer.observe(element,{childList:true,subtree:true,attributes:true});
    for(const element of shadow.querySelectorAll('[data-panel]'))observer.observe(element,{attributes:true});
    (window as any).paintProbe.observer=observer;
  });
  for(let i=0;i<40;i++){await page.evaluate(i=>(window as any).fixture.event({id:`paint-${i}`,kind:'file',source:'synthetic.paint',action:'modify',status:'success',evidence:'synthetic event'}),i);await page.waitForTimeout(25);}
  const burst=await page.evaluate(()=>{
    const shadow=document.querySelector('#app')!.shadowRoot!,probe=(window as any).paintProbe,scene=(shadow.querySelector('canvas') as any).__cosmosScene;probe.observer.disconnect();
    return {changes:probe.changes,identities:probe.backgrounds.every((element:Element)=>element.isConnected),before:probe.before,after:scene.getWork(),panelLayers:shadow.querySelectorAll('.reference-panel-vector').length,coverageCanvases:shadow.querySelectorAll('[data-panel=coverage] canvas').length};
  });
  expect(burst.changes).toBe(0);expect(burst.identities).toBe(true);expect(burst.panelLayers).toBe(0);expect(burst.coverageCanvases).toBe(0);
  expect(burst.after.configurations).toBe(burst.before.configurations);expect(burst.after.graphBuilds).toBe(burst.before.graphBuilds);expect(burst.after.allocations).toBe(burst.before.allocations);
  const hover=await page.evaluate(async()=>{
    const canvas=document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any,scene=canvas.__cosmosScene,rect=canvas.getBoundingClientRect(),before=scene.getWork();
    for(let i=0;i<200;i++)canvas.dispatchEvent(new PointerEvent('pointermove',{clientX:rect.left+3,clientY:rect.top+3,bubbles:true}));
    await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));return {before,after:scene.getWork()};
  });
  expect(hover.after.picks-hover.before.picks).toBeLessThanOrEqual(2);expect(hover.after.highlights-hover.before.highlights).toBeLessThanOrEqual(1);
  const layouts=[];
  for(const [width,font] of [[244,12],[180,12],[244,20],[540,20]]){
    await page.evaluate(async({width,font})=>{const fixture=(window as any).fixture;await fixture.updateSettings({fontSize:font});await fixture.updatePanel('coverage',{...fixture.state.panels.coverage,automatic:false,x:20,y:260,width,height:190});},{width,font});
    await page.waitForTimeout(100);
    const layout=await page.locator('[data-panel=coverage]').evaluate(panel=>{
      const ring=panel.querySelector('.coverage-ring')!,percent=ring.querySelector('span')!,metrics=panel.querySelector('.coverage-metrics')!,bounds=ring.getBoundingClientRect(),text=percent.getBoundingClientRect(),content=panel.querySelector('[data-slot=card-content]')!;
      return {ring:{x:bounds.x,y:bounds.y,width:bounds.width,height:bounds.height},text:{x:text.x,y:text.y,width:text.width,height:text.height},overlap:bounds.right>metrics.getBoundingClientRect().left+1,horizontalOverflow:content.scrollWidth>content.clientWidth+1,buttons:metrics.querySelectorAll('button').length};
    });
    expect(layout.overlap).toBe(false);expect(layout.horizontalOverflow).toBe(false);expect(layout.buttons).toBe(5);
    expect(Math.abs(layout.text.x+layout.text.width/2-layout.ring.x-layout.ring.width/2)).toBeLessThan(1);expect(Math.abs(layout.text.y+layout.text.height/2-layout.ring.y-layout.ring.height/2)).toBeLessThan(1);
    await page.locator('[data-panel=coverage]').screenshot({path:info.outputPath(`coverage-layout-${width}-${font}.png`)});layouts.push({width,font,...layout});
  }
  await page.locator('[data-panel=coverage]').getByRole('button',{name:/条跨球关系记录/}).click();await expect(page.getByRole('dialog')).toBeVisible();
  await writeFile(info.outputPath('ui-stability.json'),JSON.stringify({burst,hover,layouts},null,2));
});
