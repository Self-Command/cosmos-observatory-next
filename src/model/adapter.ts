import createSystem from './reference/system-engine.cjs';
import createProjectIndex from './reference/project-index.cjs';
import referenceSchema from './reference/system-schema.json';
import Ajv from 'ajv';
import type { App } from 'obsidian';
import type { ModelState, BusinessEvaluation, Issue } from '../core/types';
export interface PublicationRecord { path:string;fileVersion:string;url:string;commit:string;verifiedAt:number;method:'http' }
export interface ModelOptions { now?:number;version?:string;accepted?:(path:string)=>boolean;publications?:PublicationRecord[] }
// This facade exposes reads only. Original engine closures can never write the live vault.
export function readOnlyFacade(app:App){
  const deny=()=>{throw Error('Observatory business adapter is read-only');};
  return {vault:{getMarkdownFiles:()=>app.vault.getMarkdownFiles(),getAllLoadedFiles:()=>app.vault.getAllLoadedFiles(),getAbstractFileByPath:(path:string)=>app.vault.getAbstractFileByPath(path),cachedRead:app.vault.cachedRead.bind(app.vault),read:app.vault.read.bind(app.vault),create:deny,modify:deny,rename:deny,delete:deny,process:deny},metadataCache:{getFileCache:app.metadataCache.getFileCache.bind(app.metadataCache),getFirstLinkpathDest:app.metadataCache.getFirstLinkpathDest.bind(app.metadataCache)},fileManager:{renameFile:deny,processFrontMatter:deny}};
}
const validate=new Ajv({allErrors:true,strict:false}).compile({type:'object',required:['version','entities','sources','formats'],properties:{version:{const:3},entities:{type:'object',additionalProperties:{type:'object',required:['folder','folders','statuses'],properties:{folder:{type:'string'},folders:{type:'array',items:{type:'string'}},statuses:{type:'array',items:{type:'string'}}}}},sources:{type:'array',items:{type:'string'}},formats:{type:'array',items:{type:'string'}}}});
export function evaluateModel(app:App,schema:unknown,engineVerified:boolean,options:ModelOptions={}):ModelState{
  if(!validate(schema))return {status:'incompatible',version:String((schema as any)?.version??''),reason:'Schema 与当前已验证 v3 引擎契约不兼容',issues:[],coveredPaths:[]};
  if(!engineVerified)return {status:'changed',version:'3',reason:'Engine 变化，需要 Actions 兼容验证后的新构建',issues:[],coveredPaths:[]};
  const facade=readOnlyFacade(app);if(options.accepted){facade.vault.getMarkdownFiles=()=>app.vault.getMarkdownFiles().filter(file=>options.accepted!(file.path));facade.vault.getAllLoadedFiles=()=>app.vault.getAllLoadedFiles().filter(file=>options.accepted!(file.path));}
  const system=createSystem(facade,schema);
  const index=createProjectIndex(facade,schema,system).collect();
  const files=facade.vault.getMarkdownFiles().filter(file=>/^(星云|太阳|月亮|地球|黑洞)\//.test(file.path)&&!file.path.startsWith((schema as typeof referenceSchema).attachmentFolder+'/')&&!file.path.startsWith('星云/星尘/阅读数据/'));
  const coveredPaths=files.map(file=>file.path);
  const pending=coveredPaths.filter(path=>!app.metadataCache.getFileCache(app.vault.getAbstractFileByPath(path) as any));
  const checkedAt=options.now??Date.now(),version=options.version??'3',syntaxIssues=system.inspect(),issues=[...syntaxIssues,...index.issues];
  const ruleFor=(reason:string)=>reason.includes('目录')||reason.includes('route')?'business.directory':reason.includes('project')||reason.includes('项目')?'business.project':reason.includes('status')?'business.stage':reason.includes('Date')||reason.includes('updated')?'business.date':'business.properties';
  const evaluations:Record<string,BusinessEvaluation>={};
  for(const file of files){
    const fm=app.metadataCache.getFileCache(file)?.frontmatter??{},fileVersion=`${file.stat?.mtime??0}:${file.stat?.size??0}`;
    const fileIssues:Issue[]=issues.filter(issue=>issue.path===file.path).map(issue=>({rule:ruleFor(issue.reason),message:issue.reason}));
    const evaluation:BusinessEvaluation={path:file.path,fileVersion,modelVersion:version,checkedAt,entity:typeof fm.type==='string'?fm.type:undefined,status:pending.includes(file.path)?'pending':fileIssues.length?'issues':'pass',issues:fileIssues,rules:['business.stage','business.directory','business.properties','business.project','business.date']};
    if(['task','output'].includes(fm.type)){evaluation.archive=system.archiveEligibility(file,fm,new Date(checkedAt));evaluation.rules.push('business.archive');}
    if(fm.type==='output'){
      const proof=options.publications?.find(record=>record.path===file.path&&record.fileVersion===fileVersion&&record.method==='http'&&Number.isFinite(record.verifiedAt)&&record.verifiedAt<=checkedAt&&/^[0-9a-f]{40,64}$/i.test(record.commit)&&/^https:\/\//.test(record.url));
      evaluation.publication={allowed:fm.publish===true,status:proof?'evidenced':'unassessed',reason:proof?'已保存当前文件版本的 HTTP 核验记录；本次检查未重新访问网站':'没有当前文件版本可核验的上线记录',evidence:proof?`${proof.url} · ${proof.commit} · ${new Date(proof.verifiedAt).toISOString()}`:undefined};evaluation.rules.push('business.publication');
    }
    evaluations[file.path]=evaluation;
  }
  return {status:pending.length?'pending':'ready',version,reason:pending.length?`${pending.length} 个业务文件缓存待就绪`:'原始 inspect()、project-index.collect() 与 archiveEligibility()；只读评估',checkedAt,issues,coveredPaths:coveredPaths.filter(path=>!pending.includes(path)),evaluations};
}
