import { describe,it,expect } from 'vitest';
import { evaluateModel } from '../../src/model/adapter';
import schema from '../../src/model/reference/system-schema.json';
describe('Original vault rules through a read-only facade',()=>{
  const data={type:'note',status:schema.entities.note.defaultStatus,route:schema.entities.note.folder,tags:[],source:schema.sources[0],format:schema.formats[0],publish:false,project:[],created:'2026-10-10',updated:'2026-10-10'};
  const file={path:schema.entities.note.folder+'/test.md',name:'test.md',basename:'test',extension:'md',parent:{path:schema.entities.note.folder}};
  const app:any={vault:{getMarkdownFiles:()=>[file],getAllLoadedFiles:()=>[file],getAbstractFileByPath:(path:string)=>path===file.path?file:undefined,cachedRead:async()=>'',read:async()=>'',modify:()=>{throw Error('business mutation');}},metadataCache:{getFileCache:()=>({frontmatter:data}),getFirstLinkpathDest:()=>undefined}};
  it('uses all 18 entities and original validation reasons',()=>{expect(Object.keys(schema.entities)).toHaveLength(18);const result=evaluateModel(app,schema,true);expect(result.status).toBe('ready');expect(result.coveredPaths).toContain(file.path);expect(result.issues).toEqual([]);});
  it('blocks a changed engine and incompatible schema',()=>{expect(evaluateModel(app,schema,false).status).toBe('changed');expect(evaluateModel(app,{...schema,version:99},true).status).toBe('incompatible');});
});
