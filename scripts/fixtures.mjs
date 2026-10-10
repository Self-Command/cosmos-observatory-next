import './guard.mjs';import { mkdir,writeFile,cp,readFile } from 'node:fs/promises';
const schema=JSON.parse(await readFile('src/model/reference/system-schema.json','utf8'));const root='fixtures/synthetic-vault';await mkdir(root,{recursive:true});for(const world of ['太阳','月亮','地球','星云','银河','宇宙','黑洞'])await mkdir(`${root}/${world}`,{recursive:true});
await mkdir(`${root}/宇宙/演化/脚本/lib`,{recursive:true});for(const file of ['system-schema.json','system-engine.cjs','project-index.cjs'])await cp(`src/model/reference/${file}`,`${root}/宇宙/演化/脚本/lib/${file}`);
for(const [key,entity] of Object.entries(schema.entities)){await mkdir(`${root}/${entity.folder}`,{recursive:true});const file=`${root}/${entity.folder}/合成-${key}.md`;const fm={type:key,status:entity.defaultStatus,route:entity.folder,tags:[],source:schema.sources[0],format:schema.formats[0],publish:false,project:[],created:'2026-10-10',updated:'2026-10-10'};await writeFile(file,'---\n'+Object.entries(fm).map(([k,v])=>`${k}: ${JSON.stringify(v)}`).join('\n')+'\n---\n\n# 合成测试文件\n');}
for(const world of ['太阳','月亮','地球','星云','银河','宇宙','黑洞'])for(let i=0;i<64;i++)await writeFile(`${root}/${world}/视觉合成-${i}.md`,`# 视觉合成文件\n[[${world}/视觉合成-${(i+1)%64}]]\n`);
if(process.env.HOST_PROFILE==='stress')for(let i=0;i<10000;i++){const world=['太阳','月亮','地球','星云','银河','宇宙','黑洞'][i%7];await writeFile(`${root}/${world}/压力-${i}.md`,`# 压力文件 ${i}\n`);}
await writeFile(`${root}/太阳/太阳.md`,'# 世界索引\n[[地球/地球]]\n');await writeFile(`${root}/地球/地球.md`,'# 世界索引\n[[太阳/太阳]]\n');await mkdir(`${root}/.obsidian`,{recursive:true});await writeFile(`${root}/.obsidian/community-plugins.json`,'["cosmos-observatory-next"]');
// The WDIO service installs main.js/manifest/styles; ship the immutable package's
// additional assets through its copied vault, just as a real ZIP installation does.
await cp('dist/plugin',`${root}/.obsidian/plugins/cosmos-observatory-next`,{recursive:true});
