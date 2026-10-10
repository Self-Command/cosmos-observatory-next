import createSystem from './reference/system-engine.cjs';
import createProjectIndex from './reference/project-index.cjs';
import referenceSchema from './reference/system-schema.json';
import Ajv from 'ajv';
import type { App } from 'obsidian';
import type { ModelState } from '../core/types';
// This facade exposes reads only. Original engine closures can never write the live vault.
export function readOnlyFacade(app:App){
  const deny=()=>{throw Error('Observatory business adapter is read-only');};
  return {vault:{getMarkdownFiles:()=>app.vault.getMarkdownFiles(),getAllLoadedFiles:()=>app.vault.getAllLoadedFiles(),getAbstractFileByPath:(path:string)=>app.vault.getAbstractFileByPath(path),cachedRead:app.vault.cachedRead.bind(app.vault),read:app.vault.read.bind(app.vault),create:deny,modify:deny,rename:deny,delete:deny,process:deny},metadataCache:{getFileCache:app.metadataCache.getFileCache.bind(app.metadataCache),getFirstLinkpathDest:app.metadataCache.getFirstLinkpathDest.bind(app.metadataCache)},fileManager:{renameFile:deny,processFrontMatter:deny}};
}
const validate=new Ajv({allErrors:true,strict:false}).compile({type:'object',required:['version','entities','sources','formats'],properties:{version:{const:3},entities:{type:'object',additionalProperties:{type:'object',required:['folder','folders','statuses'],properties:{folder:{type:'string'},folders:{type:'array',items:{type:'string'}},statuses:{type:'array',items:{type:'string'}}}}},sources:{type:'array',items:{type:'string'}},formats:{type:'array',items:{type:'string'}}}});
export function evaluateModel(app:App,schema:unknown,engineVerified:boolean):ModelState{
  if(!validate(schema))return {status:'incompatible',version:String((schema as any)?.version??''),reason:'Schema 与当前已验证 v3 引擎契约不兼容',issues:[],coveredPaths:[]};
  if(!engineVerified)return {status:'changed',version:'3',reason:'Engine 变化，需要 Actions 兼容验证后的新构建',issues:[],coveredPaths:[]};
  const facade=readOnlyFacade(app),system=createSystem(facade,schema);
  const index=createProjectIndex(facade,schema,system).collect();
  const coveredPaths=app.vault.getMarkdownFiles().filter(file=>/^(星云|太阳|月亮|地球|黑洞)\//.test(file.path)&&!file.path.startsWith((schema as typeof referenceSchema).attachmentFolder+'/')&&!file.path.startsWith('星云/星尘/阅读数据/')).map(file=>file.path);
  const pending=coveredPaths.filter(path=>!app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(path) as any));
  if(pending.length)return {status:'pending',version:'3',reason:`${pending.length} 个业务文件缓存待就绪`,issues:[],coveredPaths:[]};
  return {status:'ready',version:'3',reason:'原始 inspect() 与 project-index.collect()；新增世界不冒充业务覆盖',checkedAt:Date.now(),issues:[...system.inspect(),...index.issues],coveredPaths};
}
