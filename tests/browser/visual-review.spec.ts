import {test,expect,type Page,type TestInfo} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {registry} from '../../src/core/settings';
import {panelIds} from '../../src/ui/panel-layout';

test.setTimeout(600000);
test.use({video:'off'});
const records:{name:string;viewport:unknown;dialog:unknown}[]=[];
async function capture(page:Page,info:TestInfo,name:string){
  const popup=page.getByRole('dialog');let dialog:unknown;
  if(await popup.count()){
    await expect(popup).toBeVisible();const bounds=(await popup.boundingBox())!,viewport=page.viewportSize()!;
    expect(bounds.x).toBeGreaterThanOrEqual(-1);expect(bounds.y).toBeGreaterThanOrEqual(-1);expect(bounds.x+bounds.width).toBeLessThanOrEqual(viewport.width+1);expect(bounds.y+bounds.height).toBeLessThanOrEqual(viewport.height+1);
    const close=popup.getByRole('button',{name:'Close',exact:true});await expect(close).toBeVisible();const closeBounds=(await close.boundingBox())!;expect(closeBounds.y).toBeGreaterThanOrEqual(bounds.y);expect(closeBounds.y+closeBounds.height).toBeLessThanOrEqual(bounds.y+bounds.height);
    const title=popup.getByRole('heading').first();await expect(title).toBeVisible();dialog=await popup.evaluate(element=>({width:element.clientWidth,scrollWidth:element.scrollWidth,font:getComputedStyle(element).fontSize,title:element.querySelector('h2')?.textContent}));expect((dialog as any).scrollWidth).toBeLessThanOrEqual((dialog as any).width+1);
    if(!await page.getByRole('listbox').count()){await page.keyboard.press('Tab');expect(await page.evaluate(()=>!!document.querySelector('#app')!.shadowRoot!.activeElement?.closest('.cosmos-portal'))).toBe(true);}
  }
  await page.screenshot({path:info.outputPath(`${name}.png`)});records.push({name,viewport:page.viewportSize(),dialog});
}
async function close(page:Page){await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toHaveCount(0);}

test('Every panel, dialog, sheet, dropdown, select and tooltip has wide and narrow visual evidence',async({page},info)=>{
  records.length=0;await page.goto('/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();
  const longPath='地球/用于复检中文长标题与多级路径的项目记录'.repeat(1)+'/这是一份包含长文件名和关联证据的实际测试材料.md';
  await page.evaluate(async path=>{const fixture=(window as any).fixture;await fixture.updateSettings({animationPaused:true,patrolPaused:true});await fixture.add(path,'# Visual evidence');await fixture.add('库根复检.js','const = ;');fixture.event({id:'visual-agent',at:Date.now(),kind:'agent',source:'synthetic.contract',sessionId:'视觉复检会话',runId:'visual-run',toolId:'visual-tool',toolName:'Read',action:'read.partial',path,status:'success',evidence:'公开工具通知；仅部分读取证据',readRange:{offset:20,limit:40}});await fixture.saveSnapshot();},longPath);
  for(const [width,font,prefix] of [[1560,12,'wide'],[560,20,'narrow-large']] as const){
    await page.setViewportSize({width,height:1120});await page.evaluate(async font=>{await (window as any).fixture.updateSettings({fontSize:font});},font);
    await capture(page,info,`${prefix}-dashboard`);
    for(const [kind,title] of [['实体','世界与文件浏览'],['系统','模型与扩展系统'],['检查','完整检查结果'],['会话','来源、会话与工具'],['回放','历史回放']]){
      await page.getByRole('navigation',{name:'观测入口'}).getByRole('button',{name:kind,exact:true}).click();await expect(page.getByRole('dialog').getByRole('heading',{name:title,exact:true})).toBeVisible();
      if(kind==='系统'){await page.evaluate(()=>(window as any).fixture.seedVisualAssets());await page.getByRole('dialog').locator('.evidence-detail summary').first().click();await page.getByRole('button',{name:'确认已了解职责',exact:true}).click();await expect(page.getByRole('button',{name:'取消职责确认',exact:true})).toBeVisible();}
      if(kind==='会话')await page.getByRole('dialog').getByText('来源接入说明与配置预览',{exact:true}).click();
      await capture(page,info,`${prefix}-entry-${kind}`);
      if(kind==='检查'){
        await page.getByRole('dialog').getByRole('combobox',{name:'检查状态',exact:true}).click();await expect(page.getByRole('listbox')).toBeVisible();await capture(page,info,`${prefix}-select`);await page.getByRole('listbox').press('End');await expect(page.getByRole('option',{name:'失败',exact:true})).toBeFocused();await page.keyboard.press('Enter');await expect(page.getByRole('listbox')).toHaveCount(0);await page.getByRole('dialog').getByRole('button',{name:'清除筛选',exact:true}).click();
      }
      await close(page);
    }
    await page.getByLabel('搜索文件',{exact:true}).fill(longPath);await capture(page,info,`${prefix}-search`);await page.keyboard.press('Enter');await page.getByRole('button',{name:'文件证据',exact:true}).click();await expect(page.getByRole('dialog')).toContainText(longPath);await capture(page,info,`${prefix}-file-sheet`);await close(page);
    await page.getByRole('button',{name:'打开设置',exact:true}).click();
    const groups=[...new Set(Object.values(registry).map(value=>value.group)),'独立世界','面板布局','导入导出'];
    for(const group of groups){const tab=page.getByRole('tab',{name:group,exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');if(group==='导入导出')await page.getByRole('button',{name:'生成配置文本',exact:true}).click();await capture(page,info,`${prefix}-settings-${group}`);const scroller=page.getByRole('dialog').locator('.settings-scroll');await scroller.evaluate(element=>element.scrollTop=element.scrollHeight);await capture(page,info,`${prefix}-settings-${group}-end`);await scroller.evaluate(element=>element.scrollTop=0);}
    await close(page);
    await page.getByRole('button',{name:'面板列表',exact:true}).click();await expect(page.getByRole('menu')).toBeVisible();await capture(page,info,`${prefix}-panel-menu`);await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:1560,height:1120});await page.evaluate(async()=>{await (window as any).fixture.updateSettings({fontSize:12});});
  for(const [id,title] of panelIds){await page.getByRole('button',{name:`${title}最大化`,exact:true}).click();await capture(page,info,`panel-${id}-maximized`);await page.getByRole('button',{name:`${title}最大化`,exact:true}).click();}
  const events=page.locator('[data-panel=events]');await events.getByText(/筛选 ·/).click();await events.getByRole('button',{name:'完整事件列表',exact:true}).click();await capture(page,info,'events-full');await page.getByRole('dialog').locator('.event-line').first().click();await capture(page,info,'event-evidence');await close(page);
  for(const [label,name] of [[/条跨球关系记录/,'cross'],[/记录 ·.*连接/,'relations'],[/个无解析关系文件/,'isolated'],[/条未解析链接/,'unresolved']]){await page.locator('[data-panel=coverage]').getByRole('button',{name:label}).click();await capture(page,info,`coverage-${name}`);await close(page);}
  await page.getByRole('button',{name:'查看关联文件',exact:true}).click();await capture(page,info,'coverage-linked');await close(page);
  await page.locator('[data-panel=heat] .heat-row button').last().click();await capture(page,info,'heat-cell-events');await close(page);
  await page.getByRole('button',{name:'事件轨迹锁定',exact:true}).hover();await expect(page.getByRole('tooltip')).toBeVisible();await capture(page,info,'panel-tooltip');await page.mouse.move(10,10);
  await writeFile(info.outputPath('visual-surface-inventory.json'),JSON.stringify({reference:'Approved original SVG; DOM typography and adaptive layout',records},null,2));
});
