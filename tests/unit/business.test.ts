import {describe,it,expect} from 'vitest';
import {evaluateModel} from '../../src/model/adapter';
import schema from '../../src/model/reference/system-schema.json';
const now=Date.parse('2026-10-10T12:00:00Z');
function modelApp(key:string,overrides:Record<string,unknown>={}){
  const entity=(schema.entities as Record<string,any>)[key],folder=entity.folder;
  const file={path:folder+'/synthetic.md',name:'synthetic.md',basename:'synthetic',extension:'md',parent:{path:folder},stat:{mtime:1,size:100}};
  const fm={type:key,status:entity.defaultStatus,route:folder,tags:[],source:schema.sources[0],format:schema.formats[0],publish:false,project:[],created:'2026-10-10',updated:'2026-10-10',...overrides};
  const archiveFolder={path:schema.archiveFolder+'/'+(schema.archiveCategories as any)[key],name:'category'};
  const mutations=()=>{throw Error('read-only violation');};
  const app:any={vault:{getMarkdownFiles:()=>[file],getAllLoadedFiles:()=>[file,archiveFolder],getAbstractFileByPath:(value:string)=>value===file.path?file:value===archiveFolder.path?archiveFolder:undefined,cachedRead:async()=>'',read:async()=>'',create:mutations,modify:mutations,rename:mutations,delete:mutations},metadataCache:{getFileCache:()=>({frontmatter:fm}),getFirstLinkpathDest:()=>undefined}};
  return {app,file,fm};
}
describe('18 actual entity rule evaluations',()=>{
  for(const key of Object.keys(schema.entities))it(`${key}: valid and invalid evidence stays separate from parser results`,()=>{const valid=modelApp(key);const result=evaluateModel(valid.app,schema,true,{now,version:'verified-version'});expect(result.evaluations?.[valid.file.path]?.status).toBe('pass');expect(result.evaluations?.[valid.file.path]?.modelVersion).toBe('verified-version');expect(result.evaluations?.[valid.file.path]?.fileVersion).toBe('1:100');const invalid=modelApp(key,{status:'__invalid_stage__'});const broken=evaluateModel(invalid.app,schema,true,{now});expect(broken.evaluations?.[invalid.file.path]?.issues.some(issue=>issue.rule==='business.stage')).toBe(true);});
  it('uses original seven-day eligibility at the exact boundary without writing files',()=>{const fixture=modelApp('task',{status:'done',completedDate:new Date(now-7*86400000).toISOString()});expect(evaluateModel(fixture.app,schema,true,{now:now-1}).evaluations?.[fixture.file.path]?.archive?.eligible).toBe(false);expect(evaluateModel(fixture.app,schema,true,{now}).evaluations?.[fixture.file.path]?.archive?.eligible).toBe(true);});
  it('distinguishes publication permission from current-version stored verification',()=>{const fixture=modelApp('output',{publish:true,status:'published',publishedDate:'2026-10-01'});const missing=evaluateModel(fixture.app,schema,true,{now});expect(missing.evaluations?.[fixture.file.path]?.publication).toMatchObject({allowed:true,status:'unassessed'});const proof={path:fixture.file.path,fileVersion:'1:100',url:'https://example.invalid/public-test',commit:'a'.repeat(40),verifiedAt:now-100,method:'http' as const};expect(evaluateModel(fixture.app,schema,true,{now,publications:[proof]}).evaluations?.[fixture.file.path]?.publication?.status).toBe('evidenced');expect(evaluateModel(fixture.app,schema,true,{now,publications:[{...proof,fileVersion:'old'}]}).evaluations?.[fixture.file.path]?.publication?.status).toBe('unassessed');});
  it('applies the same exclusion scope to business rules as file data',()=>{const fixture=modelApp('note',{status:'invalid'});expect(evaluateModel(fixture.app,schema,true,{now,accepted:()=>false}).coveredPaths).toEqual([]);expect(evaluateModel(fixture.app,schema,true,{now,accepted:()=>false}).issues).toEqual([]);});
});
