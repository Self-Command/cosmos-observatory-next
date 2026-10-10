import { describe,it,expect } from 'vitest';
import { projectVault,renameIdentity,forgetIdentity } from '../../src/core/index';
import { defaults,validateSettings,registry } from '../../src/core/settings';
import { inspectSyntax } from '../../src/core/syntax';
import { HistoryStore } from '../../src/history/store';
import { emptySnapshot,type PersistentState,type FileDescriptor } from '../../src/core/types';
const state=():PersistentState=>({schemaVersion:1,settings:defaults(),identities:{},worlds:{},panels:{}});
describe('Actual folders and evidence',()=>{
  it('discovers empty unknown worlds and real file nodes with semantic colors',()=>{const actual=projectVault({entries:[{path:'地球',name:'地球'},{path:'实验室',name:'实验室'},{path:'地球/a.md',name:'a.md',extension:'md',mtime:1,size:1,cacheReady:true}],links:{},resolve:()=>undefined},state(),defaults());expect(actual.worlds).toHaveLength(2);expect(actual.files).toHaveLength(1);expect(actual.worlds.find(w=>w.name==='地球')?.color).toBe('#72C8F5');expect(actual.worlds.find(w=>w.name==='实验室')?.confirmed).toBe(false);expect(actual.worlds.find(w=>w.name==='实验室')?.count).toBe(0);});
  it('preserves identities through folder rename and creates a new id after deletion',()=>{const value=state();value.identities={'太阳':'world','太阳/a.md':'file'};renameIdentity(value,'太阳','恒星');expect(value.identities['恒星/a.md']).toBe('file');forgetIdentity(value,'恒星/a.md');const data=projectVault({entries:[{path:'恒星',name:'恒星'},{path:'恒星/a.md',name:'a.md',extension:'md'}],links:{},resolve:()=>undefined},value,defaults());expect(data.files[0].id).not.toBe('file');});
  it('accepts only real source and target files, no unresolved or decorative nodes',()=>{const data=projectVault({entries:[{path:'A',name:'A'},{path:'B',name:'B'},{path:'A/a.md',name:'a',extension:'md',properties:{project:['[[B/b]]']}},{path:'B/b.md',name:'b',extension:'md'}],links:{'A/a.md':{'B/b.md':1,'Missing.md':1}},resolve:()=> 'B/b.md'},state(),defaults());expect(data.relations).toHaveLength(2);expect(data.files).toHaveLength(2);expect(data.relations.map(r=>r.kind)).toEqual(['link','property']);});
});
describe('Mature parsers',()=>{
  const file=(extension:string,asset?:FileDescriptor['asset']):FileDescriptor=>({id:'a',path:'A/a.'+extension,name:'a',extension,version:'1',worldId:'A',size:1,cacheReady:true,asset});
  it('detects real JS errors and repair',()=>{expect(inspectSyntax(file('js'),'const = ;').issues.length).toBeGreaterThan(0);expect(inspectSyntax(file('js'),'const fixed = 1;').issues).toHaveLength(0);});
  it('finds JSON, YAML, frontmatter and template errors without executing',()=>{expect(inspectSyntax(file('json'),'{bad}').issues).toHaveLength(1);expect(inspectSyntax(file('yaml'),'x: [').issues).toHaveLength(1);expect(inspectSyntax(file('md'),'---\nx: [\n---\n').issues).toHaveLength(1);expect(inspectSyntax(file('md','template'),'<%* const = ; %>').issues).toHaveLength(1);expect(inspectSyntax(file('js'),'throw Error("must never execute")').issues).toHaveLength(0);});
  it('reports explicit dependencies and unsupported types honestly',()=>{expect(inspectSyntax(file('ts'),"import { x } from './other';").dependencies).toEqual(['./other']);expect(inspectSyntax(file('png'),'binary').unassessed).toHaveLength(1);});
});
describe('Settings and history',()=>{
  it('rejects bad parameter types/ranges and ensures all entries have controls',()=>{const values=validateSettings({fps:999,patrolInterval:'fast',timezone:'not-a-zone',animationPaused:true});expect(values.fps).toBe(defaults().fps);expect(values.animationPaused).toBe(true);expect(values.timezone).toBe('Asia/Shanghai');for(const def of Object.values(registry)){expect(def.label).toBeTruthy();expect(['number','boolean','string','color','select']).toContain(def.type);}});
  it('stores snapshots and rotates expired history without source text',async()=>{const store=new HistoryStore(state());await store.load();const snapshot=emptySnapshot();snapshot.at=Date.now()-20*86400000;await store.save(state(),snapshot,14,5);expect(store.snapshots()).toHaveLength(0);await store.save(state(),emptySnapshot(),14,5);expect(store.snapshots()).toHaveLength(1);expect(JSON.stringify(store.snapshots())).not.toContain('noteBody');});
});
