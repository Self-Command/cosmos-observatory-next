import { Patrol } from '../../src/core/patrol';
import { projectVault, renameIdentity, forgetIdentity, type RawEntry } from '../../src/core/index';
import { defaults, validateSettings } from '../../src/core/settings';
import { emptySnapshot, type PersistentState, type Snapshot, type WorldLayout, type PanelLayout } from '../../src/core/types';
import { HistoryStore } from '../../src/history/store';
import type { Controller } from '../../src/ui/controller';
export class FixtureController implements Controller {
  state:PersistentState={schemaVersion:1,settings:defaults(),identities:{},worlds:{},panels:{}};snapshot=emptySnapshot();private callbacks=new Set<()=>void>();private entries:RawEntry[]=[];private contents=new Map<string,string>();private version=1;private history=new HistoryStore(this.state);private patrol:Patrol;
  constructor(){
    for(const name of ['太阳','月亮','地球','星云','银河','宇宙','黑洞']){this.entries.push({path:name,name});for(let i=0;i<35;i++){const path=`${name}/${i===0?name:`文件-${i.toString().padStart(2,'0')}`}.md`;this.entries.push({path,name:path.split('/').pop()!,extension:'md',mtime:1,size:12,cacheReady:true});this.contents.set(path,`# 合成文件 ${name} ${i}\n`);}}
    this.patrol=new Patrol({files:()=>this.snapshot.files,relations:()=>this.snapshot.relations,current:id=>this.snapshot.files.find(f=>f.id===id),read:async file=>this.contents.get(file.path)??'',hash:async text=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))).map(b=>b.toString(16).padStart(2,'0')).join(''),unresolved:()=>[],result:result=>{this.snapshot={...this.snapshot,results:{...this.snapshot.results,[result.fileId]:result},events:[...this.snapshot.events,{id:crypto.randomUUID(),at:Date.now(),kind:'inspection' as const,source:'local.parser',action:'inspect',status:result.status==='pass'?'success' as const:'failed' as const,path:result.path,fileId:result.fileId,evidence:`${result.rules} ${result.hash}`}].slice(-5000)};this.emit();},state:patrol=>{if(!this.snapshot.replay){this.snapshot={...this.snapshot,patrol};this.emit();}}},this.settings);
    void this.refresh();this.patrol.start();
  }
  get settings(){return validateSettings(this.state.settings);}
  subscribe=(callback:()=>void)=>{this.callbacks.add(callback);return()=>this.callbacks.delete(callback);};getSnapshot=()=>this.snapshot;private emit(){this.snapshot={...this.snapshot};this.callbacks.forEach(fn=>fn());}
  async refresh(){const links:Record<string,Record<string,number>>={};const files=this.entries.filter(e=>e.extension);files.forEach((file,index)=>{links[file.path]={[files[(index+1)%files.length].path]:1};if(index%11===0)links[file.path][files[(index+35)%files.length].path]=1;});const projection=projectVault({entries:this.entries,links,resolve:link=>this.entries.find(e=>e.path===link||e.path===link+'.md')?.path},this.state,this.settings);this.snapshot={...this.snapshot,...projection,revision:this.snapshot.revision+1,at:Date.now(),model:{status:'ready',version:'3',reason:'浏览器合成数据；业务规则只在原生宿主验证',issues:[],coveredPaths:[]},sourceStatus:'合成数据测试入口；没有模拟智能体理解'};this.emit();}
  async updateSettings(values:Record<string,unknown>){this.state.settings=validateSettings({...this.state.settings,...values});this.patrol.configure(this.settings);this.emit();await this.refresh();}
  async updateWorld(id:string,patch:Partial<WorldLayout>){this.state.worlds[id]=Object.assign({position:[0,0,0],rotation:[0,0,0],locked:false},this.state.worlds[id],patch);this.emit();}
  async updatePanel(id:string,layout:PanelLayout){this.state.panels[id]=layout;this.emit();}
  historySnapshots(){return this.history.snapshots();}replay(index:number){const history=this.historySnapshots()[index];if(history){this.patrol.suspend();this.snapshot={...history,replay:true};this.emit();}}
  async live(){this.snapshot.replay=false;await this.refresh();this.patrol.configure(this.settings);}
  async add(path:string,text?:string){this.version++;if(text===undefined){this.entries.push({path,name:path.split('/').pop()!});}else{const extension=path.split('.').pop()!;this.entries.push({path,name:path.split('/').pop()!,extension,mtime:this.version,size:new TextEncoder().encode(text).length,cacheReady:true});this.contents.set(path,text);}await this.refresh();const file=this.snapshot.files.find(f=>f.path===path);if(file)this.patrol.changed(file);}
  async modify(path:string,text:string){this.version++;const entry=this.entries.find(e=>e.path===path);if(!entry)return;entry.mtime=this.version;entry.size=text.length;this.contents.set(path,text);await this.refresh();const file=this.snapshot.files.find(f=>f.path===path)!;delete this.snapshot.results[file.id];this.patrol.changed(file);}
  async rename(oldPath:string,newPath:string){renameIdentity(this.state,oldPath,newPath);for(const entry of this.entries)if(entry.path===oldPath||entry.path.startsWith(oldPath+'/')){const old=entry.path;entry.path=newPath+old.slice(oldPath.length);entry.name=entry.path.split('/').pop()!;if(this.contents.has(old)){this.contents.set(entry.path,this.contents.get(old)!);this.contents.delete(old);}}await this.refresh();}
  async saveSnapshot(){await this.history.save(this.state,this.snapshot,14,100);}
  destroy(){this.patrol.destroy();this.callbacks.clear();}
}
