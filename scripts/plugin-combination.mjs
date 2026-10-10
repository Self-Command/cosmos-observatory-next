import './guard.mjs';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const plugins=JSON.parse(await readFile('docs/plugin-combination.json','utf8'));
const paths=[];
for(const plugin of plugins){
  const directory=`fixtures/synthetic-vault/.obsidian/plugins/${plugin.id}`;
  await mkdir(directory,{recursive:true});
  for(const [name,expected] of Object.entries(plugin.files)){
    const url=`https://github.com/${plugin.repo}/releases/download/${plugin.version}/${name}`;
    const response=await fetch(url);if(!response.ok)throw Error(`${plugin.id}/${name}: ${response.status}`);
    const bytes=Buffer.from(await response.arrayBuffer());
    const actual=createHash('sha256').update(bytes).digest('hex');
    if(actual!==expected)throw Error(`${plugin.id}/${name}: public release differs from authorized installed code (${actual})`);
    await writeFile(`${directory}/${name}`,bytes);
  }
  paths.push(directory);
}
await writeFile('fixtures/synthetic-vault/.obsidian/community-plugins.json',JSON.stringify(['cosmos-observatory-next',...plugins.map(p=>p.id)]));
await writeFile('fixtures/plugin-paths.json',JSON.stringify(paths));
console.log(`Verified ${plugins.length} installed-version plugin releases; no private data.json imported`);
