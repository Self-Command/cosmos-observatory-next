import {test,expect} from '@playwright/test';
import {writeFile} from 'node:fs/promises';
import {registry,defaults,type SettingDefinition} from '../../src/core/settings';
test.use({video:'off'});
test('Every registered setting is reachable, commits its draft and restores its group through actual controls',async({page},info)=>{
  test.setTimeout(300000);await page.goto('/');await expect(page.getByText('630 文件',{exact:true})).toBeVisible();await page.evaluate(async()=>{await (window as any).fixture.updateSettings({animationPaused:true,patrolPaused:true});});
  await page.getByRole('button',{name:'打开设置',exact:true}).click();const rows:unknown[]=[],base=defaults();
  for(const group of [...new Set(Object.values(registry).map(value=>value.group))]){
    const tab=page.getByRole('tab',{name:group,exact:true});await tab.click();await expect(tab).toHaveAttribute('aria-selected','true');
    for(const [key,value] of Object.entries(registry).filter(([,definition])=>definition.group===group)){
      const definition=value as SettingDefinition;const previous=await page.evaluate(key=>(window as any).fixture.settings[key],key);let next:string|number|boolean;
      if(definition.type==='boolean'){next=!previous;await page.getByRole('switch',{name:definition.label,exact:true}).click();}
      else if(definition.type==='number'){
        next=key==='nodeBudget'?50:key==='labelBudget'?20:Number((Math.min(definition.max!,Number(previous)+definition.step!)).toPrecision(10));if(next===previous)next=definition.min!;
        const input=page.getByRole('spinbutton',{name:definition.label,exact:true});await input.fill(String(next));expect(await page.evaluate(key=>(window as any).fixture.settings[key],key)).toBe(previous);await input.press('Enter');
      }else if(definition.type==='select'){next=definition.options!.find(option=>option!==previous)!;await page.getByRole('tabpanel').getByRole('button',{name:next,exact:true}).click();}
      else{next=definition.type==='color'?'#88bbdd':key==='timezone'?'UTC':key==='include'?'地球':key==='exclude'?'.git,.obsidian,.trash,地球/文件-0.md':String(previous)?String(previous)+'-audit':'audit.json';const input=page.getByLabel(definition.label,{exact:true});await input.fill(String(next));expect(await page.evaluate(key=>(window as any).fixture.settings[key],key)).toBe(previous);await input.press('Enter');}
      await expect.poll(()=>page.evaluate(key=>(window as any).fixture.settings[key],key)).toBe(next);await expect(page.locator('.settings-feedback')).toContainText('保存设置成功');
      const effect=await page.evaluate(()=>{const shadow=document.querySelector('#app')!.shadowRoot!,canvas=shadow.querySelector('canvas') as any,scene=canvas.__cosmosScene;return {files:(window as any).fixture.snapshot.files.length,nodes:scene.debug().positions.length,rootFont:getComputedStyle(shadow.querySelector('.cosmos-root')!).fontSize,backgroundDisplay:(shadow.querySelector('.reference-space') as HTMLElement).style.display,backgroundFilter:(shadow.querySelector('.reference-space') as HTMLElement).style.filter,fov:scene.camera.fov,exposure:scene.renderer.toneMappingExposure,nodeGlow:scene.glowMaterial.opacity,edgeOpacity:scene.edgeLines.material.opacity,edgeWidth:scene.edgeLines.material.linewidth,edges:scene.edgeLines.visible,labelCount:shadow.querySelectorAll('.file-label').length,worker:scene.physics.debug().sequence};});
      if(key==='include')expect(effect.files).toBe(90);if(key==='nodeBudget')expect(effect.nodes).toBe(50);if(key==='fontSize')expect(parseFloat(effect.rootFont)).toBe(next);if(key==='background')expect(effect.backgroundDisplay).toBe(next?'block':'none');if(key==='fov')expect(effect.fov).toBe(next);if(key==='nodeGlow')expect(effect.nodeGlow).toBe(next);if(key==='exposure')expect(effect.exposure).toBe(next);if(key==='edgeOpacity')expect(effect.edgeOpacity).toBe(next);if(key==='edgeWidth')expect(effect.edgeWidth).toBe(next);if(key==='edges')expect(effect.edges).toBe(next);
      rows.push({key,label:definition.label,group,previous,next,controlCommitted:true,effect});await page.evaluate(async({key,previous})=>{await (window as any).fixture.updateSettings({[key]:previous});},{key,previous});
    }
    await page.getByRole('button',{name:'恢复本组默认',exact:true}).click();const keys=Object.entries(registry).filter(([,definition])=>definition.group===group).map(([key])=>key);await expect.poll(()=>page.evaluate(keys=>keys.map(key=>(window as any).fixture.settings[key]),keys)).toEqual(keys.map(key=>base[key as keyof typeof base]));
    const restored=await page.evaluate(()=>(window as any).fixture.settings);for(const [key,definition] of Object.entries(registry))if(definition.group===group)expect(restored[key]).toBe(base[key as keyof typeof base]);
    await page.evaluate(async()=>{await (window as any).fixture.updateSettings({animationPaused:true,patrolPaused:true});});
  }
  await writeFile(info.outputPath('every-setting-control.json'),JSON.stringify({count:rows.length,scope:'Actual control reachability, draft commit, full controller propagation, group reset and selected observable rendering/index effects; complete consumers are recorded by the unit settings audit',rows},null,2));
});
