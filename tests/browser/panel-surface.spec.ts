import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {PNG} from 'pngjs';

test.use({video:'off'});
test.setTimeout(180000);
type Sample={id:string;rgb:number[];deviation:number;pixels:number};
async function pixels(page:Page,info:TestInfo,name:string):Promise<Sample[]>{
  const metadata=await page.locator('[data-panel]').evaluateAll(panels=>panels.map(panel=>{const rect=panel.getBoundingClientRect();return {id:`${(panel.getRootNode() as ShadowRoot).host.id}:${panel.getAttribute('data-panel')}`,left:rect.left,top:rect.top,right:rect.right,bottom:rect.bottom,rgb:getComputedStyle(panel).backgroundColor.match(/[\d.]+/g)!.slice(0,3).map(Number)};}));
  const x=Math.floor(Math.min(...metadata.map(rect=>rect.left))),y=Math.floor(Math.min(...metadata.map(rect=>rect.top))),clip={x,y,width:Math.ceil(Math.max(...metadata.map(rect=>rect.right)))-x,height:Math.ceil(Math.max(...metadata.map(rect=>rect.bottom)))-y};
  const png=await page.screenshot({path:info.outputPath(`${name}.png`),scale:'css',clip});
  // Decode in the test process, away from both busy WebGL contexts.
  const decoded=PNG.sync.read(png);
  return metadata.map(rect=>{
    const left=Math.ceil(rect.left+4-clip.x),top=Math.ceil(rect.top+20-clip.y),offset=(top*decoded.width+left)*4;let deviation=0;
    for(let row=0;row<10;row++)for(let column=0;column<3;column++)for(let channel=0;channel<3;channel++)deviation=Math.max(deviation,Math.abs(decoded.data[((top+row)*decoded.width+left+column)*4+channel]-rect.rgb[channel]));
    return {id:rect.id,rgb:[decoded.data[offset],decoded.data[offset+1],decoded.data[offset+2]],deviation,pixels:30};
  });
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
  await page.waitForTimeout(800);await page.mouse.move(700,500);await page.screenshot({path:info.outputPath('graph-with-panels.png'),scale:'css'});
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
