import { semanticPresets, splitList, type Settings } from './settings';
import type { FileDescriptor, RelationDescriptor, UnresolvedLink, WorldDescriptor, PersistentState } from './types';
export interface RawEntry { path:string; name:string; extension?:string; mtime?:number; size?:number; cacheReady?:boolean; properties?:Record<string,unknown> }
export interface VaultProjection { entries:RawEntry[]; links:Record<string,Record<string,number>>; nativeLinks?:Record<string,Record<string,number>>; unresolved?:Record<string,Record<string,number>>; resolve:(link:string,from:string)=>string|undefined }
export function identity(state:PersistentState,path:string){return Object.hasOwn(state.identities,path)?state.identities[path]:(state.identities[path]=crypto.randomUUID());}
export function renameIdentity(state:PersistentState,oldPath:string,newPath:string){
  for(const path of Object.keys(state.identities)) if(path===oldPath || path.startsWith(oldPath+'/')){state.identities[newPath+path.slice(oldPath.length)]=state.identities[path];delete state.identities[path];}
}
export function forgetIdentity(state:PersistentState,path:string){for(const key of Object.keys(state.identities))if(key===path||key.startsWith(path+'/'))delete state.identities[key];}
export class VaultEntryIndex {
  private entries=new Map<string,RawEntry>();
  replace(entries:RawEntry[]){this.entries=new Map(entries.map(entry=>[entry.path,entry]));}
  upsert(entry:RawEntry){this.entries.set(entry.path,entry);}
  remove(path:string){for(const key of this.entries.keys())if(key===path||key.startsWith(path+'/'))this.entries.delete(key);}
  rename(oldPath:string,newPath:string){for(const [key,entry] of [...this.entries])if(key===oldPath||key.startsWith(oldPath+'/')){this.entries.delete(key);const path=newPath+key.slice(oldPath.length);this.entries.set(path,{...entry,path,name:path.split('/').at(-1)!});}}
  values(){return [...this.entries.values()];}
}
export function projectVault(input:VaultProjection,state:PersistentState,settings:Settings){
  const include=splitList(settings.include),exclude=splitList(settings.exclude);
  const accepted=(path:string)=>!exclude.some(prefix=>path===prefix||path.startsWith(prefix+'/'))&&(!include.length||include.some(prefix=>path===prefix||path.startsWith(prefix+'/')||prefix.startsWith(path+'/')));
  const entries=input.entries.filter(e=>e.path && accepted(e.path));
  const roots=new Set(entries.filter(e=>!e.path.includes('/') && e.extension===undefined).map(e=>e.path));
  const worlds:WorldDescriptor[]=Array.from(roots).sort((a,b)=>a.localeCompare(b,'zh-CN')).map(path=>{
    const id=identity(state,path),preset=semanticPresets[path],override=state.worlds[id];
    return {id,path,name:path,color:override?.color??preset?.color??'#9CA7C0',role:override?.role??preset?.role??'职责待确认',confirmed:override?.confirmed??!!preset,coverage:'unassessed',count:0};
  });
  const byRoot=new Map(worlds.map(w=>[w.path,w]));
  const files:FileDescriptor[]=entries.filter(e=>e.extension!==undefined).flatMap(entry=>{
    const root=entry.path.includes('/')?entry.path.split('/')[0]:null,world=root?byRoot.get(root):undefined;if(root&&!world)return [];
    const extension=entry.extension!.toLowerCase();
    const parts=entry.path.split('/').slice(0,-1);
    let asset:FileDescriptor['asset'];
    if(splitList(settings.templates).some(prefix=>parts.some(p=>p.toLowerCase().includes(prefix.toLowerCase()))))asset='template';
    else if(['js','ts','mjs','cjs','tsx','jsx','py','ps1','sh'].includes(extension)||splitList(settings.scripts).some(prefix=>parts.some(p=>p.toLowerCase().includes(prefix.toLowerCase()))))asset='script';
    if(entry.path===String(settings.schemaPath)||entry.path===String(settings.enginePath))asset='model';
    const id=identity(state,entry.path);if(world)world.count++;
    return [{id,path:entry.path,name:entry.name,extension,worldId:world?.id??null,version:`${entry.mtime??0}:${entry.size??0}`,size:entry.size??0,cacheReady:entry.cacheReady??extension!=='md',asset,entity:typeof entry.properties?.type==='string'?entry.properties.type:undefined}];
  });
  const byPath=new Map(files.map(f=>[f.path,f]));
  for(const world of worlds){const override=state.worlds[world.id];world.centerId=[override?.centerPath,`${world.path}/${world.name}.md`,`${world.path}/index.md`].map(path=>path?byPath.get(path):undefined).find(file=>file?.worldId===world.id)?.id;}
  const relations:RelationDescriptor[]=[],unresolved:UnresolvedLink[]=[];const seen=new Set<string>();
  const add=(from:string,to:string,kind:RelationDescriptor['kind'],evidence:string)=>{const source=byPath.get(from),target=byPath.get(to);if(!source||!target)return;const id=`${source.id}|${target.id}|${kind}|${evidence}`;if(!seen.has(id)){seen.add(id);relations.push({id,source:source.id,target:target.id,kind,evidence});}};
  for(const [from,targets] of Object.entries(input.links))for(const to of Object.keys(targets))add(from,to,'link','Obsidian metadataCache.resolvedLinks');
  for(const [from,targets] of Object.entries(input.nativeLinks??{}))for(const to of Object.keys(targets))add(from,to,'link','CosmoGraph native vault reader');
  const missing=(from:string,target:string,kind:UnresolvedLink['kind'],evidence:string)=>{const source=byPath.get(from);if(!source)return;const id=`${source.id}|${target}|${kind}|${evidence}`;if(!seen.has(id)){seen.add(id);unresolved.push({id,source:source.id,path:from,target,kind,evidence});}};
  for(const [from,targets] of Object.entries(input.unresolved??{}))for(const target of Object.keys(targets))missing(from,target,'link','Obsidian metadataCache.unresolvedLinks');
  for(const entry of entries)for(const key of splitList(settings.propertyKeys)){
    const value=entry.properties?.[key];for(const link of Array.isArray(value)?value:[value])if(typeof link==='string'){
      const match=/^\[\[([^\]|#]+)(?:#[^\]|]*)?(?:\|[^\]]*)?\]\]$/.exec(link);if(!match)continue;const path=input.resolve(match[1],entry.path);if(path)add(entry.path,path,'property',`frontmatter.${key}: ${link}`);else missing(entry.path,match[1],'property',`frontmatter.${key}: ${link}`);
    }
  }
  return {worlds,files,relations,unresolved};
}
