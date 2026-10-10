import './guard.mjs';
import { readFile, readdir } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const hash=buffer=>createHash('sha256').update(buffer).digest('hex');
const sources=JSON.parse(await readFile('docs/cosmograph-source.json','utf8'));
for(const file of sources.files){if(hash(await readFile(`vendor/cosmograph/${file.path}`))!==file.sha256)throw Error(`Original source changed: ${file.path}`);}
const official=JSON.parse(await readFile('docs/shadcn-source.json','utf8'));
for(const source of official.components){if(hash(await readFile(`src/ui/official/${source.name}.tsx`))!==source.customizedSHA256)throw Error(`Unregistered official UI patch: ${source.name}`);}
const model=JSON.parse(await readFile('docs/model-source.json','utf8'));
for(const [file,expected] of Object.entries(model.files)){if(hash(await readFile(`src/model/reference/${file}`))!==expected)throw Error(`Model source changed without verification: ${file}`);}
const spider=JSON.parse(await readFile('docs/spider-source.json','utf8'));if(hash(await readFile('assets/spider.glb'))!==spider.sha256)throw Error('Spider asset changed');
const testPlugins=JSON.parse(await readFile('docs/plugin-combination.json','utf8'));
for(const plugin of testPlugins){for(const [file,expected] of Object.entries(plugin.files))if(hash(await readFile(`vendor/test-plugins/${plugin.id}/${file}`))!==expected)throw Error(`Installed combination bundle changed: ${plugin.id}/${file}`);if(plugin.sourceArchiveSHA256&&hash(await readFile(`vendor/test-plugins/${plugin.id}/CORRESPONDING-SOURCE.zip`))!==plugin.sourceArchiveSHA256)throw Error(`Corresponding source changed: ${plugin.id}`);}
if(hash(await readFile('docs/assets/dashboard-spheres-v2.svg'))!=='0869ac88be4692aa0568029ff9a8490e16e07a18d8e7eb9969c2ff26bb a1bae2'.replace(' ',''))throw Error('Approved SVG reference changed');
const forbidden=[/gh[pousr]_[a-zA-Z0-9]{32,}/,/sk-[a-zA-Z0-9]{32,}/,/-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/];
async function inspect(directory){for(const entry of await readdir(directory,{withFileTypes:true})){const file=`${directory}/${entry.name}`;if(['.git','node_modules','sources','dist','fixtures','test-results','playwright-report'].includes(entry.name))continue;if(entry.isDirectory())await inspect(file);else if(/\.(ts|tsx|js|mjs|cjs|json|md|yml|yaml)$/.test(file)){if(/\/(data|receiver-token)\.json$/.test(file)||file.includes('/.obsidian/'))throw Error(`Private state in source: ${file}`);const content=await readFile(file,'utf8');if(forbidden.some(regex=>regex.test(content)))throw Error(`Potential credential in ${file}`);}}}
await inspect('.');
console.log('Pinned source, licenses, asset hashes and public source boundaries verified.');
