import {it,expect} from 'vitest';
import {readFile,readdir,mkdir,writeFile} from 'node:fs/promises';
import {registry} from '../../src/core/settings';
import {physicsParameters} from '../../src/physics/protocol';
import {defaults} from '../../src/core/settings';
it('registers every visual setting with a product consumer and records the implementation audit',async()=>{
  const sources:{path:string;text:string}[]=[];
  const walk=async(path:string)=>{for(const entry of await readdir(path,{withFileTypes:true})){const file=`${path}/${entry.name}`;if(entry.isDirectory()){if(entry.name!=='framework')await walk(file);}else if(/\.tsx?$/.test(file)&&file!=='src/core/settings.ts')sources.push({path:file,text:await readFile(file,'utf8')});}};
  await walk('src');const rows=[];
  for(const [key,definition] of Object.entries(registry)){
    const consumers=sources.flatMap(source=>{const pattern=new RegExp(`\\b(?:settings|next\\.settings|this\\.settings|controller\\.settings|this\\.state\\.settings)\\.${key}\\b`,'g'),matches=[...source.text.matchAll(pattern)];return matches.map(match=>({path:source.path,line:source.text.slice(0,match.index).split('\n').length}));});
    expect(consumers.length,`${key} must have a real product consumer`).toBeGreaterThan(0);rows.push({key,label:definition.label,group:definition.group,type:definition.type,consumers});
  }
  const values=defaults(),parameters=physicsParameters(values);for(const [key,property] of [['centerForce','center'],['repulsion','repulsion'],['linkForce','link'],['crossLinkForce','crossLink'],['linkDistance','distance'],['radialForce','radial'],['collisionPadding','collision'],['damping','damping'],['worldRotation','rotation']] as const){const altered=physicsParameters({...values,[key]:Number(values[key])+.001});expect(altered[property]).not.toBe(parameters[property]);}
  await mkdir('test-results/settings',{recursive:true});await writeFile('test-results/settings/setting-consumers.json',JSON.stringify({count:rows.length,scope:'Product consumers and physics parameter propagation; browser and host tests verify actual controls and visual changes',rows},null,2));
});
