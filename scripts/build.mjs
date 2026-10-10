import './guard.mjs';
import { build } from 'esbuild';
import { readFile, writeFile, mkdir, cp, readdir } from 'node:fs/promises';
import postcss from 'postcss';
import tailwind from '@tailwindcss/postcss';
import { builtinModules } from 'node:module';
import { createHash } from 'node:crypto';
await mkdir('dist/plugin/assets',{recursive:true});await mkdir('dist/harness',{recursive:true});
const cssText=await readFile('src/ui/theme.css','utf8');const compiled=await postcss([tailwind()]).process(cssText,{from:'src/ui/theme.css'});
const cssPlugin={name:'compiled-isolated-theme',setup(build){build.onLoad({filter:/theme\.css$/},()=>({contents:`export default ${JSON.stringify(compiled.css)}`,loader:'js'}));}};
// Radix focus utilities use document.activeElement, which resolves to the host in an
// open ShadowRoot. Keep the upstream components and adapt their DOM boundary only.
const shadowFocusPlugin={name:'radix-shadow-focus',setup(builder){builder.onLoad({filter:/[\\/]@radix-ui[\\/]react-[^\\/]+[\\/]dist[\\/].*\.[mc]?js$/},async args=>{
  let source=await readFile(args.path,'utf8');if(!source.includes('.activeElement')&&!args.path.includes('react-focus-scope'))return;
  source=source.replace(/\b(document|ownerDocument)\.activeElement\b/g,'cosmosDeepActiveElement($1)');
  if(args.path.includes('react-focus-scope'))source=source.replace(/event\.target\b/g,'(event.composedPath()[0] ?? event.target)');
  return {contents:`function cosmosDeepActiveElement(root){let active=root.activeElement;while(active?.shadowRoot?.activeElement)active=active.shadowRoot.activeElement;return active;}\n${source}`,loader:'js'};
});}};
const physics=await build({entryPoints:['src/physics/physics.worker.ts'],bundle:true,platform:'browser',format:'iife',target:'es2022',write:false,minify:true,legalComments:'eof'});
const workerPlugin={name:'bundled-physics-worker',setup(builder){builder.onResolve({filter:/\?worker$/},args=>({path:args.path,namespace:'physics-worker'}));builder.onLoad({filter:/.*/,namespace:'physics-worker'},()=>({contents:`export default ${JSON.stringify(physics.outputFiles[0].text)}`,loader:'js'}));}};
await build({entryPoints:['src/main.ts'],outfile:'dist/plugin/main.js',bundle:true,platform:'node',format:'cjs',target:'es2022',external:['obsidian','electron',...builtinModules,...builtinModules.map(name=>'node:'+name)],plugins:[cssPlugin,workerPlugin,shadowFocusPlugin],loader:{'.css':'text','.svg':'text'},minify:true,legalComments:'eof'});
await build({entryPoints:['src/events/bridge.ts'],outfile:'dist/plugin/bridge.mjs',bundle:true,platform:'node',format:'esm',target:'es2022',external:[...builtinModules,...builtinModules.map(name=>'node:'+name)],minify:true,legalComments:'eof'});
await build({entryPoints:['tests/harness/main.tsx'],outfile:'dist/harness/main.js',bundle:true,platform:'browser',format:'esm',target:'es2022',plugins:[cssPlugin,workerPlugin,shadowFocusPlugin],loader:{'.svg':'text'},minify:true,legalComments:'eof'});
for(const file of ['manifest.json','styles.css'])await cp(file,`dist/plugin/${file}`);
await cp('assets/spider.glb','dist/plugin/assets/spider.glb');await cp('assets/spider.glb','dist/harness/spider.glb');
await cp('tests/harness/index.html','dist/harness/index.html');await cp('vendor/cosmograph/LICENSE','dist/plugin/COSMOGRAPH-LICENSE');await cp('src/ui/official/LICENSE.md','dist/plugin/SHADCN-LICENSE.md');
await cp('docs/assets/dashboard-spheres-v2.svg','dist/harness/reference.svg');
await cp('LICENSE','dist/plugin/LICENSE');
await writeFile('dist/plugin/THIRD-PARTY-NOTICES.md',await readFile('docs/THIRD-PARTY-NOTICES.md'));
for(const file of ['USER-GUIDE.md','SOURCE-INTEGRATIONS.md','COMPLETION-MATRIX.md','VISUAL-REVIEW.md','PROGRESS.md'])await cp(`docs/${file}`,`dist/plugin/${file}`);
const provenance={commit:process.env.GITHUB_SHA,run:`https://github.com/${process.env.GITHUB_REPOSITORY}/actions/runs/${process.env.GITHUB_RUN_ID}`,builtOnce:true,purpose:'Immutable input; candidate packaging requires all verification jobs',lockSHA256:createHash('sha256').update(await readFile('package-lock.json')).digest('hex'),cosmograph:'c455f466f7df9c23724ba291aa9f2463ca553aaa'};
await writeFile('dist/plugin/BUILD-INFO.json',JSON.stringify(provenance,null,2));
const integrity={};async function hashDirectory(relative=''){for(const entry of await readdir(`dist/plugin/${relative}`,{withFileTypes:true})){const file=relative+entry.name;if(entry.isDirectory())await hashDirectory(file+'/');else integrity[file]=createHash('sha256').update(await readFile(`dist/plugin/${file}`)).digest('hex');}}await hashDirectory();await writeFile('dist/integrity.json',JSON.stringify(integrity,null,2));
