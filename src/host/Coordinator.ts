import { TFile, type TAbstractFile, type App, type EventRef } from 'obsidian';
import debounce from 'lodash/debounce';
import PQueue from 'p-queue';
import { createHash, randomBytes } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { createStream } from 'rotating-file-stream';
import { buildVaultGraph } from '../framework/cosmograph/obsidian/vaultGraph';
import { projectVault, renameIdentity, forgetIdentity, VaultEntryIndex, type RawEntry } from '../core/index';
import { defaults, validateSettings, assertSettings, type Settings } from '../core/settings';
import { emptySnapshot, type Snapshot, type PersistentState, type InspectionResult, type ObservatoryEvent, type WorldLayout, type PanelLayout, type NodeLayout, type SpatialState, type AssetDescriptor, type SourceState } from '../core/types';
import { Patrol } from '../core/patrol';
import { HistoryStore } from '../history/store';
import { RecoveringHistoryAdapter } from '../history/disk';
import { evaluateModel, type PublicationRecord } from '../model/adapter';
import modelLock from '../../docs/model-source.json';
import { EventReceiver } from '../events/receiver';
import { validWorld, validPanel, validNode, migrateState, parseConfiguration } from '../core/layout';
import { dependencyRelations } from '../core/dependencies';

export class Coordinator {
  private realtime=emptySnapshot();private replaySnapshot:Snapshot|undefined;
  state:PersistentState=migrateState(null);
  get snapshot(){return this.replaySnapshot??this.realtime;}
  private notify=debounce(()=>this.listeners.forEach(listener=>listener()),80,{maxWait:160});
  private listeners=new Set<()=>void>();private refs:{owner:'vault'|'metadataCache';ref:EventRef}[]=[];
  private queue=new PQueue({concurrency:1});private mutations=new PQueue({concurrency:1});private index=new VaultEntryIndex();
  private patrol:Patrol;private history!:HistoryStore;private logger:ReturnType<typeof pino>|undefined;private logStream:ReturnType<typeof createStream>|undefined;private receiver:EventReceiver|undefined;
  private receiverSignature='';private logSignature='';private started=false;private stopped=false;
  private historyTimer:ReturnType<typeof setInterval>|undefined;private extensionTimer:ReturnType<typeof setInterval>|undefined;private refreshDebounced:ReturnType<typeof debounce>;
  private seenEvents=new Set<string>();private settingsInput:PersistentState['settings']|undefined;private settingsCache=defaults();
  private modelTexts=new Map<string,{version:string;text:string}>();private schema:Record<string,any>|undefined;
  constructor(readonly app:App,private directory:string){
    this.refreshDebounced=debounce(()=>{void this.refresh(false);},1000,{maxWait:5000});
    this.patrol=new Patrol({files:()=>this.realtime.files,relations:()=>this.realtime.relations,current:id=>{const cached=this.realtime.files.find(file=>file.id===id);if(!cached)return;const actual=this.app.vault.getAbstractFileByPath(cached.path);return actual instanceof TFile?{...cached,version:`${actual.stat.mtime}:${actual.stat.size}`,cacheReady:actual.extension!=='md'||!!this.app.metadataCache.getFileCache(actual)}:undefined;},read:async file=>{const actual=this.app.vault.getAbstractFileByPath(file.path);if(!(actual instanceof TFile))throw Error('文件不存在');return this.app.vault.read(actual);},unresolved:file=>Object.keys(this.app.metadataCache.unresolvedLinks[file.path]??{}),hash:async text=>this.hash(text),result:result=>this.acceptResult(result),state:patrol=>{if(this.stopped)return;this.realtime={...this.realtime,patrol};this.emit();}},defaults());
  }
  private hash(text:string){return createHash('sha256').update(text).digest('hex');}
  get settings(){if(this.settingsInput!==this.state.settings){this.settingsInput=this.state.settings;this.settingsCache=validateSettings(this.state.settings);}return this.settingsCache;}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  getSnapshot=()=>this.snapshot;
  getLayoutState=():SpatialState=>this.replaySnapshot?.space??{worlds:this.replaySnapshot?{}:this.state.worlds,panels:this.replaySnapshot?{}:this.state.panels,nodes:this.replaySnapshot?{}:this.state.nodes??{},revision:this.state.layoutRevision??0};
  private emit(){if(!this.stopped)this.notify();}
  private report(message:string){this.realtime={...this.realtime,error:message};this.emit();}
  private raw(file:TAbstractFile):RawEntry{return {path:file.path,name:file.name,...(file instanceof TFile?{extension:file.extension,mtime:file.stat.mtime,size:file.stat.size,cacheReady:file.extension!=='md'||!!this.app.metadataCache.getFileCache(file),properties:this.app.metadataCache.getFileCache(file)?.frontmatter}:{})};}
  async start(){
    if(this.started)return;this.started=true;await mkdir(this.directory,{recursive:true});
    this.history=new HistoryStore(this.state,new RecoveringHistoryAdapter(this.directory,()=>this.recoveryMiB()*1024*1024,message=>this.report(message)));
    const data=await this.history.load();this.state=migrateState(data.state);
    const previous=data.snapshots.at(-1);if(previous){this.realtime={...this.realtime,files:previous.files,assets:previous.assets??[],assetChanges:previous.assetChanges??[],results:previous.results??{},events:previous.events.slice(-Number(this.settings.eventLimit))};this.patrol.restoreCounters(previous.patrol);for(const event of this.realtime.events)this.seenEvents.add(this.eventKey(event));}
    this.configureLogging();this.configureDebounces();
    const vault=this.app.vault;
    const add=(owner:'vault'|'metadataCache',ref:EventRef)=>this.refs.push({owner,ref});
    add('vault',vault.on('create',file=>{this.index.upsert(this.raw(file));this.changed('create',file.path);}));
    add('vault',vault.on('modify',file=>{this.index.upsert(this.raw(file));this.changed('modify',file.path);}));
    add('vault',vault.on('rename',(file,old)=>{const id=this.state.identities[old];this.index.rename(old,file.path);this.index.upsert(this.raw(file));renameIdentity(this.state,old,file.path);this.changed('rename',file.path,id,old);}));
    add('vault',vault.on('delete',file=>{const id=this.state.identities[file.path];this.index.remove(file.path);forgetIdentity(this.state,file.path);this.changed('delete',file.path,id);}));
    add('metadataCache',this.app.metadataCache.on('changed',file=>{this.index.upsert(this.raw(file));this.refreshDebounced();}));
    add('metadataCache',this.app.metadataCache.on('resolved',()=>this.refreshDebounced()));
    await this.refresh();if(previous){const old=new Map(previous.files.map(file=>[file.path,file.version])),now=new Map(this.realtime.files.map(file=>[file.path,file.version]));this.event({kind:'system',source:'local.recovery',action:'offline.net-change',status:'unknown',evidence:`关闭期间净变化：新增 ${[...now.keys()].filter(file=>!old.has(file)).length}、修改 ${[...now].filter(([file,version])=>old.has(file)&&old.get(file)!==version).length}、删除 ${[...old.keys()].filter(file=>!now.has(file)).length}；期间过程未知`});}
    this.patrol.configure(this.settings);this.patrol.start();await this.configureReceiver();this.configureHistory();
  }
  private changed(action:string,filePath:string,fileId=this.state.identities[filePath],previousPath?:string){if(filePath.startsWith(this.app.vault.configDir+'/plugins/cosmos-observatory-next/'))return;this.event({kind:'file',source:'obsidian.vault',action,path:filePath,previousPath,fileId,status:'success',evidence:'Vault 事件；无智能体归因'});this.refreshDebounced();}
  private eventKey(event:Pick<ObservatoryEvent,'source'|'sessionId'|'id'>){return `${event.source}:${event.sessionId??''}:${event.id}`;}
  event(input:Omit<ObservatoryEvent,'id'|'at'> & Partial<Pick<ObservatoryEvent,'id'|'at'>>){
    if(this.stopped)return;const event={...input,id:input.id??crypto.randomUUID(),at:input.at??Date.now()} as ObservatoryEvent,key=this.eventKey(event);if(this.seenEvents.has(key))return;
    this.seenEvents.add(key);while(this.seenEvents.size>Number(this.settings.eventLimit)*2)this.seenEvents.delete(this.seenEvents.values().next().value!);
    const events=[...this.realtime.events,event].slice(-Number(this.settings.eventLimit));
    this.realtime={...this.realtime,events};this.updateSources();this.logger?.info({kind:event.kind,action:event.action,status:event.status},'observation');this.emit();
  }
  private updateSources(){
    const grouped=new Map<string,ObservatoryEvent[]>();for(const event of this.realtime.events)if(event.kind==='agent'){const group=grouped.get(event.source)??[];group.push(event);grouped.set(event.source,group);}
    this.realtime={...this.realtime,sources:[...grouped].map(([id,events]):SourceState=>{const latest=events.reduce((a,b)=>a.at>b.at?a:b),idle=Date.now()-latest.at>Number(this.settings.sourceTimeoutSeconds)*1000,sessions=[...new Set(events.map(event=>event.sessionId))],closed=sessions.every(session=>events.some(event=>event.sessionId===session&&event.action==='session.end'));return {id,status:closed?'closed':idle?'interrupted':'active',lastAt:latest.at,sessions:sessions.length,events:events.length,reason:idle?'超过来源静默阈值；连接过程未知':'最近经鉴权声明'};})};
  }
  refresh(full=true){return this.queue.add(async()=>{
    if(this.stopped)return;const before=new Map(this.realtime.files.map(file=>[file.id,file]));
    if(full||!this.realtime.revision)this.index.replace(this.app.vault.getAllLoadedFiles().map(file=>this.raw(file)));
    const upstream=buildVaultGraph(this.app,1),nativeLinks:Record<string,Record<string,number>>={};for(const edge of upstream.edges)(nativeLinks[edge.source]??={})[edge.target]=1;
    const projection=projectVault({entries:this.index.values(),links:this.app.metadataCache.resolvedLinks,nativeLinks,unresolved:this.app.metadataCache.unresolvedLinks,resolve:(link,from)=>this.app.metadataCache.getFirstLinkpathDest(link,from)?.path},this.state,this.settings);
    const results=Object.fromEntries(projection.files.flatMap(file=>{const result=this.realtime.results[file.id];return result?.version===file.version&&result.path===file.path?[[file.id,result]]:[];}));
    this.realtime={...this.realtime,...projection,results,revision:this.realtime.revision+1,at:Date.now()};
    const ids=new Set(projection.files.map(file=>file.id));for(const id of Object.keys(this.state.nodes??{}))if(!ids.has(id))delete this.state.nodes![id];
    this.syncDependencies();await this.evaluateBusiness();await this.discoverAssets();this.updateSources();
    const covered=new Set(this.realtime.model.coveredPaths);this.realtime.worlds=this.realtime.worlds.map(world=>{const members=projection.files.filter(file=>file.worldId===world.id);return {...world,coverage:members.length&&members.every(file=>covered.has(file.path))?'evaluated':this.realtime.model.status==='pending'?'pending':'unassessed'};});
    if(this.realtime.revision>1)for(const file of projection.files){const old=before.get(file.id);if(old?.version!==file.version||old?.path!==file.path||old?.cacheReady!==file.cacheReady)this.patrol.changed(file);}
    this.emit();await this.persist(false);
  }).catch(error=>{this.report(String(error));});}
  private async modelText(filePath:string){const file=this.app.vault.getAbstractFileByPath(filePath),version=file instanceof TFile?`${file.stat.mtime}:${file.stat.size}`:'';const cached=this.modelTexts.get(filePath);if(version&&cached?.version===version)return cached.text;const text=await this.app.vault.adapter.read(filePath);this.modelTexts.set(filePath,{version,text});return text;}
  private async evaluateBusiness(){
    try{const schemaText=await this.modelText(String(this.settings.schemaPath)),engine=await this.modelText(String(this.settings.enginePath));this.schema=JSON.parse(schemaText);const engineHash=this.hash(engine),engineVerified=engineHash===modelLock.files['system-engine.cjs'];let publications:PublicationRecord[]=[];
      const ledger=String(this.settings.publicationEvidencePath);if(ledger){try{const raw=JSON.parse(await this.modelText(ledger));if(!Array.isArray(raw))throw Error('核验记录必须是数组');publications=raw.filter(record=>record&&typeof record==='object');}catch(error){this.report(`上线核验记录读取失败: ${String(error)}`);}}
      const paths=new Set(this.realtime.files.map(file=>file.path));this.realtime={...this.realtime,model:evaluateModel(this.app,this.schema,engineVerified,{version:`3:${this.hash(schemaText+engineHash).slice(0,16)}`,accepted:filePath=>paths.has(filePath),publications})};
    }catch(error){this.schema=undefined;this.realtime={...this.realtime,model:{status:'missing',version:'',reason:`模型读取失败: ${String(error)}`,issues:[],coveredPaths:[],evaluations:{}}};}
  }
  private async discoverAssets(){
    const before=new Map(this.realtime.assets.map(asset=>[asset.id,asset]));const bindings=new Map<string,string[]>();
    for(const [key,entity] of Object.entries(this.schema?.entities??{}) as [string,any][]){for(const template of [entity.template,...Object.values(entity.directoryTemplates??{}).map((entry:any)=>entry.template)])if(typeof template==='string'){const keys=bindings.get(template)??[];keys.push(key);bindings.set(template,keys);}}
    const assets:AssetDescriptor[]=this.realtime.files.filter(file=>file.asset).map(file=>({id:file.id,path:file.path,kind:file.asset!,version:file.version,source:file.asset==='template'&&bindings.has(file.name)?'Schema entities.template / directoryTemplates':'Vault 目录及文件扩展名',status:'observed',dependencies:this.realtime.results[file.id]?.dependencies??[],language:file.extension,binding:bindings.get(file.name)?.join(', '),confirmed:this.state.assetConfirmations?.[file.id]??false}));
    if(this.settings.observePlugins){try{const list=await this.app.vault.adapter.list(`${this.app.vault.configDir}/plugins`);for(const directory of list.folders){if(directory.endsWith('/cosmos-observatory-next'))continue;const manifestPath=directory+'/manifest.json';try{const manifest=await this.app.vault.adapter.read(manifestPath);if(manifest.length>8192)throw Error('插件清单超过读取上限');const info=JSON.parse(manifest);if(typeof info.id!=='string'||typeof info.version!=='string')throw Error('插件清单缺少 id/version');assets.push({id:`plugin:${info.id}`,path:manifestPath,kind:'plugin',version:`${info.version}:${this.hash(manifest).slice(0,12)}`,source:'Obsidian manifest.json',status:'unassessed',dependencies:Array.isArray(info.dependencies)?info.dependencies.filter((value:unknown)=>typeof value==='string'):[],confirmed:this.state.assetConfirmations?.[`plugin:${info.id}`]??false});}catch(error){assets.push({id:`plugin-path:${directory}`,path:manifestPath,kind:'plugin',version:'unknown',source:'Obsidian manifest.json',status:'unassessed',dependencies:[],error:String(error)});}}}catch(error){assets.push(...this.realtime.assets.filter(asset=>asset.kind==='plugin'));this.report(`插件目录发现失败: ${String(error)}`);}}
    const changes=[...(this.realtime.assetChanges??[])],ids=new Set(assets.map(asset=>asset.id));
    for(const asset of assets){const old=before.get(asset.id);if(!old||old.version!==asset.version){const action=old?'changed':'added';changes.push({id:crypto.randomUUID(),at:Date.now(),assetId:asset.id,path:asset.path,action,previous:old?.version,version:asset.version});if(old)asset.status='changed';}}
    for(const asset of before.values())if(!ids.has(asset.id))changes.push({id:crypto.randomUUID(),at:Date.now(),assetId:asset.id,path:asset.path,action:'removed',previous:asset.version});
    this.realtime={...this.realtime,assets,assetChanges:changes.slice(-Number(this.settings.eventLimit))};
  }
  private syncDependencies(){this.realtime={...this.realtime,relations:[...this.realtime.relations.filter(relation=>relation.kind!=='dependency'),...dependencyRelations(this.realtime.files,this.realtime.results,path.posix.normalize)]};}
  private acceptResult(result:InspectionResult){if(this.stopped)return;const file=this.realtime.files.find(file=>file.id===result.fileId);if(!file||file.version!==result.version||file.path!==result.path)return;this.realtime={...this.realtime,results:{...this.realtime.results,[result.fileId]:result}};this.syncDependencies();this.event({kind:'inspection',source:'local.parser',action:'inspect',path:result.path,fileId:result.fileId,status:result.status==='pass'?'success':result.status==='issues'||result.status==='failed'?'failed':'unknown',evidence:`${result.read??'未知读取状态'} · ${result.rules.join(', ')||result.unassessed.join(', ')}${result.hash?' · '+result.hash:''}`});}
  private async commitState(next:PersistentState){await this.history.save(next,undefined,Number(next.settings.retentionDays),Number(next.settings.historyMiB)-Math.min(Number(next.settings.logCapacityMiB),Number(next.settings.historyMiB)*.2)-Math.min(2,Number(next.settings.historyMiB)*.1));this.state=next;this.realtime={...this.realtime};this.emit();}
  async updateSettings(input:Record<string,unknown>){assertSettings(input);await this.mutations.add(async()=>{const next={...this.state,settings:validateSettings({...this.state.settings,...input})};await this.commitState(next);this.configureDebounces();if(!this.replaySnapshot)this.patrol.configure(this.settings);this.configureLogging();this.configureHistory();await this.configureReceiver();});await this.refresh();}
  private configureDebounces(){this.notify.cancel();this.notify=debounce(()=>this.listeners.forEach(listener=>listener()),Number(this.settings.uiRefreshMs),{maxWait:Number(this.settings.uiRefreshMs)*2});this.refreshDebounced.cancel();this.refreshDebounced=debounce(()=>{void this.refresh(false);},Number(this.settings.debounceMs),{maxWait:Number(this.settings.maxWaitMs)});}
  async updateWorld(id:string,patch:Partial<WorldLayout>){const layouts=this.getLayoutState(),next=Object.assign({position:[0,0,0],rotation:[0,0,0],locked:false},layouts.worlds[id],patch);if(!validWorld(next))throw Error('世界布局无效');if(!this.snapshot.worlds.some(world=>world.id===id))throw Error('世界不存在');if(this.replaySnapshot){this.replaySnapshot={...this.replaySnapshot,space:{...layouts,worlds:{...layouts.worlds,[id]:next}}};this.emit();return;}await this.mutations.add(()=>this.commitState({...this.state,worlds:{...this.state.worlds,[id]:next}}));if(patch.color!==undefined||patch.role!==undefined||patch.centerPath!==undefined||patch.confirmed!==undefined)await this.refresh(false);}
  async updatePanel(id:string,layout:PanelLayout){if(!validPanel(layout))throw Error('面板布局无效');if(this.replaySnapshot){const space=this.getLayoutState();this.replaySnapshot={...this.replaySnapshot,space:{...space,panels:{...space.panels,[id]:layout}}};this.emit();return;}await this.mutations.add(()=>this.commitState({...this.state,panels:{...this.state.panels,[id]:layout}}));}
  async updateNode(id:string,layout:NodeLayout){if(this.replaySnapshot)throw Error('回放中无法修改实时文件位置');if(!validNode(layout)||!this.realtime.files.some(file=>file.id===id))throw Error('文件位置无效或文件不存在');await this.mutations.add(()=>this.commitState({...this.state,nodes:{...this.state.nodes,[id]:layout}}));}
  recordPositions(nodes:Record<string,NodeLayout>){if(this.replaySnapshot||this.stopped)return;const ids=new Set(this.realtime.files.map(file=>file.id));this.state.nodes={...this.state.nodes,...Object.fromEntries(Object.entries(nodes).filter(([id,node])=>ids.has(id)&&validNode(node)))};}
  async inspectFile(id:string){if(this.replaySnapshot)throw Error('回放中不运行检查');this.patrol.manual(id);await this.evaluateBusiness();this.emit();}
  async confirmAsset(id:string,confirmed:boolean){await this.mutations.add(()=>this.commitState({...this.state,assetConfirmations:{...this.state.assetConfirmations,[id]:confirmed}}));await this.refresh(false);}
  async resetLayouts(scope:'worlds'|'panels'|'all'){if(this.replaySnapshot)throw Error('请返回实时后重置布局');await this.mutations.add(()=>this.commitState({...this.state,layoutRevision:(this.state.layoutRevision??0)+1,...(scope!=='panels'?{worlds:{},nodes:{}}:{}),...(scope!=='worlds'?{panels:{}}:{})}));await this.refresh(false);}
  async applyConfiguration(text:string){const config=parseConfiguration(text);if(this.replaySnapshot)throw Error('请返回实时后应用配置');await this.mutations.add(()=>this.commitState({...this.state,...config,layoutRevision:(this.state.layoutRevision??0)+1}));this.configureDebounces();this.patrol.configure(this.settings);this.configureLogging();this.configureHistory();await this.configureReceiver();await this.refresh();}
  historySnapshots(){return this.history?.snapshots()??[];}
  replay(index:number){const target=this.historySnapshots()[index];if(!target)throw Error('此历史快照不存在');this.patrol.suspend();this.replaySnapshot={...structuredClone(target),replay:true,patrol:{...target.patrol,phase:'paused'},spatialStatus:target.space?'recorded':'missing'};this.emit();}
  async live(){if(!this.replaySnapshot)return;this.replaySnapshot=undefined;await this.refresh(false);this.patrol.configure(this.settings);this.emit();}
  private configureHistory(){if(this.historyTimer)clearInterval(this.historyTimer);if(this.extensionTimer)clearInterval(this.extensionTimer);this.historyTimer=setInterval(()=>{void this.persist(true);},Number(this.settings.snapshotSeconds)*1000);this.extensionTimer=setInterval(()=>{void this.refresh(false);},Number(this.settings.extensionPollSeconds)*1000);}
  private logBudgetMiB(){return Math.min(Number(this.settings.logCapacityMiB),Number(this.settings.historyMiB)*.2);}
  private recoveryMiB(){return Math.min(2,Number(this.settings.historyMiB)*.1);}
  private configureLogging(){const reserve=Math.floor(this.logBudgetMiB()*1024*1024),fileLimit=Math.min(Number(this.settings.logFileKiB)*1024,Math.floor(reserve/3)),signature=`${reserve}:${fileLimit}:${this.settings.retentionDays}`;if(signature===this.logSignature)return;this.logSignature=signature;this.logStream?.end();this.logStream=createStream('observatory.log',{path:this.directory,size:`${fileLimit}B`,maxSize:`${Math.max(1,reserve-fileLimit-4096)}B`,interval:'1d',maxFiles:Number(this.settings.retentionDays)});this.logStream.on('error',error=>this.report(`诊断日志不可写: ${String(error)}`));this.logger=pino({level:'info'},this.logStream);}
  private async configureReceiver(){
    if(!this.settings.receiverEnabled){await this.receiver?.close();this.receiver=undefined;this.realtime={...this.realtime,sourceStatus:'未接入；本地接收关闭'};this.emit();return;}
    const signature=`${this.settings.receiverPort}:${this.settings.receiverRate}:${this.settings.eventLimit}`;if(this.receiver&&signature===this.receiverSignature)return;await this.receiver?.close();this.receiver=undefined;this.receiverSignature=signature;
    try{let token:string;try{token=(await readFile(path.join(this.directory,'receiver-token'),'utf8')).trim();}catch{token=randomBytes(32).toString('hex');await writeFile(path.join(this.directory,'receiver-token'),token,{mode:0o600});}
      this.receiver=new EventReceiver(token,event=>{const file=event.path?this.realtime.files.find(file=>file.path===event.path):undefined;this.realtime={...this.realtime,sourceStatus:`${event.source} · 最近接收 ${new Date().toLocaleTimeString()}`};this.event({...event,...(file?{fileId:file.id}:{})});},Number(this.settings.eventLimit),Number(this.settings.receiverRate),this.realtime.events);await this.receiver.start(Number(this.settings.receiverPort));this.realtime={...this.realtime,sourceStatus:`127.0.0.1:${this.settings.receiverPort}；等待经鉴权来源`};
    }catch(error){await this.receiver?.close();this.receiver=undefined;this.realtime={...this.realtime,sourceStatus:`接收失败: ${String(error)}`};}this.emit();
  }
  private async persist(sample:boolean){if(!this.history)return;try{await this.history.save(this.state,sample?{...this.realtime,at:Date.now()}:undefined,Number(this.settings.retentionDays),Number(this.settings.historyMiB)-this.logBudgetMiB()-this.recoveryMiB());}catch(error){this.report(`状态写入失败: ${String(error)}`);}}
  async destroy(){if(this.stopped)return;this.stopped=true;this.notify.cancel();this.patrol.destroy();this.refreshDebounced.cancel();if(this.historyTimer)clearInterval(this.historyTimer);if(this.extensionTimer)clearInterval(this.extensionTimer);for(const {owner,ref} of this.refs)this.app[owner].offref(ref);this.refs=[];await this.receiver?.close();await this.queue.onIdle();await this.mutations.onIdle();await this.patrol.flush();await this.persist(true);await this.history?.flush();this.logStream?.end();this.listeners.clear();}
}
