import './guard.mjs';
import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
const file='docs/shadcn-source.json',manifest=JSON.parse(await readFile(file,'utf8'));
for(const name of ['dialog','sheet','select','dropdown-menu','tooltip']){
  const record=manifest.components.find(component=>component.name===name),response=await fetch(record.url);if(!response.ok)throw Error(`Official source unavailable: ${name}`);
  const raw=await response.text();if(createHash('sha256').update(raw).digest('hex')!==record.originalSHA256)throw Error(`Pinned official source changed: ${name}`);
  const adapted=raw.replaceAll('from "cn"','from "@/lib/utils"').replaceAll('@/registry/new-york-v4/ui/','@/ui/official/');
  const scoped='import { usePortalContainer } from "@/ui/PortalContext"\n'+adapted.replace(/<(\w+Primitive)\.Portal(?=[\s>])/g,'<$1.Portal container={usePortalContainer()}');
  if(scoped===adapted||!scoped.includes('container={usePortalContainer()}'))throw Error(`Portal patch missing: ${name}`);
  await writeFile(`src/ui/official/${name}.tsx`,scoped);record.customizedSHA256=createHash('sha256').update(scoped).digest('hex');
}
manifest.patches=['Import path adaptation','Dialog, Sheet, Select, DropdownMenu and Tooltip portals scoped to current Obsidian shadow view'];await writeFile(file,JSON.stringify(manifest,null,2)+'\n');
