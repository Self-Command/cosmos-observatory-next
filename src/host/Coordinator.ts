import { TFile, type App, type EventRef } from 'obsidian';
import debounce from 'lodash/debounce';
import PQueue from 'p-queue';
import { createHash, randomBytes } from 'node:crypto';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import pino from 'pino';
import { createStream } from 'rotating-file-stream';
import { buildVaultGraph } from '../framework/cosmograph/obsidian/vaultGraph';
import { projectVault, renameIdentity, forgetIdentity } from '../core/index';
import { defaults, validateSettings, type Settings } from '../core/settings';
import { emptySnapshot, type Snapshot, type PersistentState, type InspectionResult, type ObservatoryEvent, type WorldLayout, type PanelLayout } from '../core/types';
import { Patrol } from '../core/patrol';
import { HistoryStore, type HistoryData } from '../history/store';
import { evaluateModel } from '../model/adapter';
import modelLock from '../../docs/model-source.json';
import { EventReceiver } from '../events/receiver';

export class Coordinator {
  snapshot=emptySnapshot();state:PersistentState={schemaVersion:1,settings:defaults(),identities:{},worlds:{},panels:{}};
  private listeners=new Set<()=>void>();private refs:EventRef[]=[];private queue=new PQueue({concurrency:1});private patrol:Patrol;private history!:HistoryStore;private logger:ReturnType<typeof pino>|undefined;private logStream:ReturnType<typeof createStream>|undefined;private receiver:EventReceiver|undefined;private started=false;private stopped=false;private historyTimer:ReturnType<typeof setInterval>|undefined;private refreshDebounced:ReturnType<typeof debounce>;private directory:string;private replayLive:Snapshot|undefined;private writeSettingsQueue=new PQueue({concurrency:1});
  constructor(readonly app:App,pluginDirectory:string){
    this.directory=pluginDirectory;
    this.refreshDebounced=debounce(()=>{void this.refresh();},1000,{maxWait:5000});
    this.patrol=new Patrol({files:()=>this.snapshot.files,relations:()=>this.snapshot.relations,current:id=>this.snapshot.files.find(f=>f.id===id),read:async file=>{const actual=this.app.vault.getAbstractFileByPath(file.path);if(!(actual instanceof TFile))throw Error('文件不存在');return this.app.vault.read(actual);},unresolved:file=>Object.keys(this.app.metadataCache.unresolvedLinks[file.path]??{}),hash:async text=>createHash('sha256').update(text).digest('hex'),result:result=>this.acceptResult(result),state:patrol=>{if(this.stopped||this.snapshot.replay)return;this.snapshot={...this.snapshot,patrol};this.emit();}},defaults());
  }
  get settings(){return validateSettings(this.state.settings);}
  subscribe=(listener:()=>void)=>{this.listeners.add(listener);return()=>this.listeners.delete(listener);};
  getSnapshot=()=>this.snapshot;
  private emit(){if(this.stopped)return;this.snapshot={...this.snapshot};this.listeners.forEach(fn=>fn());}
  async start(){if(this.started)return;this.started=true;await mkdir(this.directory,{recursive:true});
    const adapter=new JSONFile<HistoryData>(path.join(this.directory,'history.json'));
    this.history=new HistoryStore(this.state,{read:async()=>{try{return await adapter.read();}catch{return null;}},write:value=>adapter.write(value)});
    const data=await this.history.load();if(data.state?.schemaVersion===1){this.state={...this.state,...data.state,settings:validateSettings(data.state.settings??{})};}
    this.logStream=createStream('observatory.log',{path:this.directory,size:'5M',interval:'1d',maxFiles:14});this.logger=pino({level:'info'},this.logStream);
    this.refreshDebounced=debounce(()=>{void this.refresh();},Number(this.settings.debounceMs),{maxWait:Number(this.settings.maxWaitMs)});
    const vault=this.app.vault;
    this.refs.push(vault.on('create',file=>this.changed('create',file.path)),vault.on('modify',file=>this.changed('modify',file.path)),vault.on('rename',(file,old)=>{renameIdentity(this.state,old,file.path);this.changed('rename',file.path);}),vault.on('delete',file=>{forgetIdentity(this.state,file.path);this.changed('delete',file.path);}));
    this.refs.push(this.app.metadataCache.on('changed',()=>this.refreshDebounced()),this.app.metadataCache.on('resolved',()=>this.refreshDebounced()));
    this.patrol.configure(this.settings);await this.refresh();this.patrol.start();await this.configureReceiver();this.configureHistory();
  }
  private changed(action:string,filePath:string){if(filePath.startsWith(this.app.vault.configDir+'/plugins/cosmos-observatory-next/'))return;this.event({kind:'file',source:'obsidian.vault',action,path:filePath,status:'success',evidence:'Vault 事件；无智能体归因'});this.refreshDebounced();}
  event(input:Omit<ObservatoryEvent,'id'|'at'> & Partial<Pick<ObservatoryEvent,'id'|'at'>>){const event={id:input.id??crypto.randomUUID(),at:input.at??Date.now(),...input} as ObservatoryEvent;if(this.snapshot.replay){if(this.replayLive)this.replayLive={...this.replayLive,events:[...this.replayLive.events,event].slice(-Number(this.settings.eventLimit))};return;}this.snapshot={...this.snapshot,events:[...this.snapshot.events,event].slice(-Number(this.settings.eventLimit))};this.logger?.info({kind:event.kind,action:event.action,status:event.status},'observation');this.emit();}
  refresh(){return this.queue.add(async()=>{
    if(this.stopped||this.snapshot.replay)return;const before=new Map(this.snapshot.files.map(f=>[f.id,f.version]));
    // Reuse the original native vault reader and its metadata-backed link source.
    const upstream=buildVaultGraph(this.app,1);const nativeLinks:Record<string,Record<string,number>>={};for(const edge of upstream.edges)(nativeLinks[edge.source]??={})[edge.target]=1;
    const entries=this.app.vault.getAllLoadedFiles().map(file=>({path:file.path,name:file.name,...(file instanceof TFile?{extension:file.extension,mtime:file.stat.mtime,size:file.stat.size,cacheReady:file.extension!=='md'||!!this.app.metadataCache.getFileCache(file),properties:this.app.metadataCache.getFileCache(file)?.frontmatter}: {})}));
    const projection=projectVault({entries,links:{...this.app.metadataCache.resolvedLinks,...nativeLinks},resolve:(link,from)=>this.app.metadataCache.getFirstLinkpathDest(link,from)?.path},this.state,this.settings);
    const results=Object.fromEntries(projection.files.flatMap(file=>{const result=this.snapshot.results[file.id];return result?.version===file.version?[[file.id,result]]:[];}));
    this.snapshot={...this.snapshot,...projection,results,revision:this.snapshot.revision+1,at:Date.now()};
    try{const schemaText=await this.app.vault.adapter.read(String(this.settings.schemaPath));const engine=await this.app.vault.adapter.read(String(this.settings.enginePath));const engineVerified=createHash('sha256').update(engine).digest('hex')===modelLock.files['system-engine.cjs'];this.snapshot.model=evaluateModel(this.app,JSON.parse(schemaText),engineVerified);}catch(error){this.snapshot.model={status:'missing',version:'',reason:`模型读取失败: ${String(error)}`,issues:[],coveredPaths:[]};}
    const covered=new Set(this.snapshot.model.coveredPaths);for(const world of this.snapshot.worlds){const members=this.snapshot.files.filter(f=>f.worldId===world.id);world.coverage=members.length&&members.every(f=>covered.has(f.path))?'evaluated':this.snapshot.model.status==='pending'?'pending':'unassessed';}
    for(const result of Object.values(this.snapshot.results)){result.businessCheckedAt=this.snapshot.model.checkedAt;result.businessVersion=this.snapshot.model.version;}
    for(const file of projection.files)if(before.get(file.id)!==file.version)this.patrol.changed(file);
    this.emit();await this.persist(false);
  }).catch(error=>{this.snapshot={...this.snapshot,error:String(error)};this.emit();});}
  private acceptResult(result:InspectionResult){if(this.stopped||this.snapshot.replay)return;const file=this.snapshot.files.find(f=>f.id===result.fileId);if(!file||file.version!==result.version)return;result.businessCheckedAt=this.snapshot.model.checkedAt;result.businessVersion=this.snapshot.model.version;this.snapshot={...this.snapshot,results:{...this.snapshot.results,[result.fileId]:result}};this.event({kind:'inspection',source:'local.parser',action:'inspect',path:result.path,fileId:result.fileId,status:result.status==='pass'?'success':result.status==='issues'||result.status==='failed'?'failed':'unknown',evidence:`${result.rules.join(', ')||result.unassessed.join(', ')} · ${result.hash}`});}
  async updateSettings(input:Record<string,unknown>){this.state.settings=validateSettings({...this.state.settings,...input});this.refreshDebounced.cancel();this.refreshDebounced=debounce(()=>{void this.refresh();},Number(this.settings.debounceMs),{maxWait:Number(this.settings.maxWaitMs)});this.patrol.configure(this.settings);this.configureHistory();await this.configureReceiver();this.emit();await this.persist(false);await this.refresh();}
  async updateWorld(id:string,patch:Partial<WorldLayout>){this.state.worlds[id]={position:[0,0,0],rotation:[0,0,0],locked:false,...this.state.worlds[id],...patch};this.emit();await this.persist(false);}
  async updatePanel(id:string,patch:PanelLayout){this.state.panels[id]=patch;this.emit();await this.persist(false);}
  historySnapshots(){return this.history?.snapshots()??[];}
  replay(index:number){const target=this.historySnapshots()[index];if(!target)return;if(!this.snapshot.replay)this.replayLive=this.snapshot;this.patrol.suspend();this.snapshot={...structuredClone(target),replay:true,patrol:{...target.patrol,phase:'paused'}};this.emit();}
  async live(){if(!this.snapshot.replay)return;this.snapshot=this.replayLive??emptySnapshot();this.replayLive=undefined;this.snapshot.replay=false;await this.refresh();this.patrol.configure(this.settings);}
  private configureHistory(){if(this.historyTimer)clearInterval(this.historyTimer);this.historyTimer=setInterval(()=>{void this.persist(true);},Number(this.settings.snapshotSeconds)*1000);}
  private async configureReceiver(){if(!this.settings.receiverEnabled){if(this.receiver)await this.receiver.close();this.receiver=undefined;this.snapshot={...this.snapshot,sourceStatus:'未接入；本地接收关闭'};return;}if(this.receiver)return;let token:string;try{token=await readFile(path.join(this.directory,'receiver-token'),'utf8');}catch{token=randomBytes(32).toString('hex');await writeFile(path.join(this.directory,'receiver-token'),token,{mode:0o600});}this.receiver=new EventReceiver(token,event=>this.event(event));try{await this.receiver.start(Number(this.settings.receiverPort));this.snapshot={...this.snapshot,sourceStatus:`127.0.0.1:${this.settings.receiverPort}；等待经鉴权来源`};}catch(error){await this.receiver.close();this.receiver=undefined;this.snapshot={...this.snapshot,sourceStatus:`接收失败: ${String(error)}`};}}
  private async persist(snapshot:boolean){try{await this.history.save(this.state,snapshot&&!this.snapshot.replay?this.snapshot:undefined,Number(this.settings.retentionDays),Number(this.settings.historyMiB));}catch(error){this.snapshot={...this.snapshot,error:`状态写入失败: ${String(error)}`};this.emit();}}
  async destroy(){this.stopped=true;this.patrol.destroy();this.refreshDebounced.cancel();if(this.historyTimer)clearInterval(this.historyTimer);for(const ref of this.refs){this.app.vault.offref(ref);this.app.metadataCache.offref(ref);}this.refs=[];await this.receiver?.close();await this.queue.onIdle();await this.history?.flush();this.logStream?.end();this.listeners.clear();}
}
