import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {writeFile} from 'node:fs/promises';

test.use({video:'on'});
type Sample={id:string;rgb:number[];deviation:number;pixels:number};
async function pixels(page:Page,info:TestInfo,name:string):Promise<Sample[]>{
  const png=await page.screenshot({path:info.outputPath(`${name}.png`),scale:'css'});
  return page.evaluate(async encoded=>{
    const image=new Image();image.src=`data:image/png;base64,${encoded}`;await image.decode();
    const buffer=document.createElement('canvas');buffer.width=image.width;buffer.height=image.height;
    const context=buffer.getContext('2d')!;context.drawImage(image,0,0);
    return [...document.querySelectorAll('#app,#peer')].flatMap(host=>[...host.shadowRoot!.querySelectorAll('[data-panel]')].map(panel=>{
      const rect=panel.getBoundingClientRect(),rgb=getComputedStyle(panel).backgroundColor.match(/[\d.]+/g)!.slice(0,3).map(Number);
      // The left content padding is empty for every card, font and layout.
      const data=context.getImageData(Math.ceil(rect.left+4),Math.ceil(rect.top+44),3,20).data;
      let deviation=0;for(let i=0;i<data.length;i+=4)for(let channel=0;channel<3;channel++)deviation=Math.max(deviation,Math.abs(data[i+channel]-rgb[channel]));
      return {id:`${host.id}:${panel.getAttribute('data-panel')}`,rgb:[data[0],data[1],data[2]],deviation,pixels:data.length/4};
    }));
  },png.toString('base64'));
}
async function assertSurfaces(page:Page,count:number){
  const surfaces=await page.locator('[data-panel]').evaluateAll(elements=>elements.map(element=>{
    const style=getComputedStyle(element);return {background:style.backgroundColor,opacity:style.opacity,backdrop:style.backdropFilter,filter:style.filter,blend:style.mixBlendMode,layers:element.querySelectorAll('.reference-panel-vector').length};
  }));
  expect(surfaces).toHaveLength(count);
  for(const surface of surfaces){expect(surface.background).toMatch(/^rgb\(/);expect(surface.opacity).toBe('1');expect(surface.backdrop).toBe('none');expect(surface.filter).toBe('none');expect(surface.blend).toBe('normal');expect(surface.layers).toBe(0);}
  return surfaces;
}
async function exercise(page:Page,info:TestInfo,peer:boolean){
  await page.goto('/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();
  await page.evaluate(async()=>{await (window as any).fixture.updateSettings({patrolPaused:true,animationPaused:false});});
  if(peer){await page.evaluate(()=>(window as any).mountPeer());await expect(page.locator('[data-panel]')).toHaveCount(12);}
  await page.waitForTimeout(800);await page.mouse.move(700,500);
  const count=peer?12:6,records:Record<string,unknown>[]=[],before=await page.evaluate(()=>((document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene.debug().frames));
  // First observe the actual moving graph, then use a bright alternating
  // underlay to make even slight transparency detectable in captured pixels.
  for(const depth of [.2,.5,1]){
    await page.evaluate(async depth=>{await (window as any).fixture.updateSettings({panelOpacity:depth});},depth);await page.waitForTimeout(150);
    const surfaces=await assertSurfaces(page,count);
    for(let frame=0;frame<3;frame++){
      await page.evaluate(frame=>(window as any).fixture.event({id:`natural-${frame}-${performance.now()}`,kind:'file',source:'synthetic.paint',action:'modify',status:'success',evidence:'continuous update'}),frame);
      const sample=await pixels(page,info,`natural-${depth}-${frame}`);for(const value of sample)expect(value.deviation,JSON.stringify(value)).toBeLessThanOrEqual(1);records.push({phase:'natural',depth,frame,surfaces,sample});await page.waitForTimeout(100);
    }
  }
  await page.evaluate(()=>{for(const host of document.querySelectorAll('#app,#peer')){const underlay=document.createElement('div');underlay.className='surface-test-underlay';underlay.style.cssText='position:absolute;inset:0;z-index:11;pointer-events:none;background:#fc00fc';host.shadowRoot!.querySelector('.cosmos-root')!.append(underlay);}});
  // Negative control proves the pixel check sees flicker, unlike a DOM check.
  await page.evaluate(()=>{(document.querySelector('#app')!.shadowRoot!.querySelector('[data-panel=coverage]') as HTMLElement).style.setProperty('background','transparent','important');});
  const negative=await pixels(page,info,'negative-transparent');expect(negative.find(sample=>sample.id==='app:coverage')!.deviation).toBeGreaterThan(100);
  await page.evaluate(()=>{(document.querySelector('#app')!.shadowRoot!.querySelector('[data-panel=coverage]') as HTMLElement).style.removeProperty('background');});
  for(const depth of [.2,.5,1]){
    await page.evaluate(async depth=>{await (window as any).fixture.updateSettings({panelOpacity:depth});},depth);
    const surfaces=await assertSurfaces(page,count);
    for(let frame=0;frame<4;frame++){
      await page.evaluate(frame=>{for(const host of document.querySelectorAll('#app,#peer'))(host.shadowRoot!.querySelector('.surface-test-underlay') as HTMLElement).style.background=frame%2?'#00fc00':'#fc00fc';(window as any).fixture.event({id:`forced-${frame}-${performance.now()}`,kind:'file',source:'synthetic.paint',action:'modify',status:'success',evidence:'continuous update'});},frame);
      const sample=await pixels(page,info,`forced-${depth}-${frame}`);for(const value of sample)expect(value.deviation,JSON.stringify(value)).toBeLessThanOrEqual(1);records.push({phase:'forced',depth,frame,surfaces,sample});await page.waitForTimeout(100);
    }
  }
  await page.evaluate(()=>{for(const host of document.querySelectorAll('#app,#peer'))host.shadowRoot!.querySelector('.surface-test-underlay')?.remove();});
  const after=await page.evaluate(()=>((document.querySelector('#app')!.shadowRoot!.querySelector('canvas') as any).__cosmosScene.debug().frames));expect(after-before).toBeGreaterThan(5);
  if(peer){await page.evaluate(()=>(window as any).unmountPeer());await expect(page.locator('[data-panel]')).toHaveCount(6);}
  const panel=page.locator('[data-panel=coverage]'),title=panel.locator('[data-slot=card-header]');
  await page.evaluate(async()=>{const fixture=(window as any).fixture;await fixture.updatePanel('coverage',{...fixture.state.panels.coverage,automatic:false,x:60,y:240,width:280,height:190});});
  const start=(await title.boundingBox())!;await page.mouse.move(start.x+70,start.y+18);await page.mouse.down();await page.mouse.move(start.x+130,start.y+60,{steps:12});await page.mouse.up();
  const grip=(await panel.locator('..').locator('.panel-resize-bottomRight').boundingBox())!;await page.mouse.move(grip.x+6,grip.y+6);await page.mouse.down();await page.mouse.move(grip.x+46,grip.y+26,{steps:10});await page.mouse.up();await page.mouse.move(700,500);
  const moved=await pixels(page,info,'after-drag-and-resize');for(const value of moved)expect(value.deviation,JSON.stringify(value)).toBeLessThanOrEqual(1);
  await writeFile(info.outputPath('panel-surface-pixels.json'),JSON.stringify({provenance:{commit:process.env.GITHUB_SHA,run:process.env.GITHUB_RUN_ID},dpr:await page.evaluate(()=>devicePixelRatio),peer,count,frames:after-before,negativeControl:negative,records,moved},null,2));
}
test('Opaque panel pixels stay fixed while the graph, events and underlay change',async({page},info)=>{await exercise(page,info,false);});
test.describe('Two simultaneous views at high DPI',()=>{
  test.use({deviceScaleFactor:2});
  test('Each view keeps opaque panel pixels through updates, dragging and resizing',async({page},info)=>{await exercise(page,info,true);});
});
