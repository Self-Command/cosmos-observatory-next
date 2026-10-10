import './guard.mjs';
import { readFile, writeFile, mkdir, cp } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const plugins=JSON.parse(await readFile('docs/plugin-combination.json','utf8'));
const paths=[];
for(const plugin of plugins){
  const directory=`fixtures/synthetic-vault/.obsidian/plugins/${plugin.id}`;
  await mkdir(directory,{recursive:true});
  for(const [name,expected] of Object.entries(plugin.files)){
    const source=`vendor/test-plugins/${plugin.id}/${name}`;
    const bytes=await readFile(source);
    const actual=createHash('sha256').update(bytes).digest('hex');
    if(actual!==expected)throw Error(`${plugin.id}/${name}: authorized installed code changed (${actual})`);
    await writeFile(`${directory}/${name}`,bytes);
  }
  paths.push(directory);
}
await writeFile('fixtures/synthetic-vault/.obsidian/community-plugins.json',JSON.stringify(['cosmos-observatory-next',...plugins.map(p=>p.id)]));
await writeFile('fixtures/plugin-paths.json',JSON.stringify(paths));
console.log(`Verified ${plugins.length} actual installed plugin bundles, including localization; no private data.json imported`);
