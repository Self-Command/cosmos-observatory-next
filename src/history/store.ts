import { Low, Memory } from 'lowdb';
import PQueue from 'p-queue';
import type { Snapshot, PersistentState } from '../core/types';
export interface HistoryData { state:PersistentState; snapshots:Snapshot[] }
export interface HistoryAdapter { read():Promise<HistoryData|null>;write(value:HistoryData):Promise<void> }
export class HistoryStore {
  private db:Low<HistoryData>;private queue=new PQueue({concurrency:1});
  constructor(state:PersistentState,adapter:HistoryAdapter=new Memory<HistoryData>()){this.db=new Low(adapter,{state,snapshots:[]});}
  async load(){await this.db.read();if(!Array.isArray(this.db.data?.snapshots))throw Error('历史快照契约错误');this.db.data.snapshots=this.db.data.snapshots.filter(snapshot=>typeof snapshot?.at==='number'&&Array.isArray(snapshot.files)&&Array.isArray(snapshot.worlds)&&Array.isArray(snapshot.events)&&Array.isArray(snapshot.relations)&&snapshot.results&&snapshot.patrol&&snapshot.model).map(snapshot=>({...snapshot,assets:snapshot.assets??[],unresolved:snapshot.unresolved??[],sources:snapshot.sources??[],assetChanges:snapshot.assetChanges??[],spatialStatus:snapshot.space?'recorded':'missing'}));return this.db.data;}
  snapshots(){return this.db.data.snapshots;}
  save(state:PersistentState,snapshot:Snapshot|undefined,days:number,mib:number){return this.queue.add(async()=>{
    const next:HistoryData={state:structuredClone(state),snapshots:this.db.data.snapshots.slice()};if(snapshot)next.snapshots.push(structuredClone({...snapshot,replay:false,space:snapshot.space??{worlds:state.worlds,panels:state.panels,nodes:state.nodes??{},revision:state.layoutRevision??0},spatialStatus:'recorded'}));
    const cutoff=Date.now()-days*86400000;next.snapshots=next.snapshots.filter(s=>s.at>=cutoff);
    const size=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
    while(next.snapshots.length&&size(next)>mib*1024*1024)next.snapshots.shift();
    if(size(next)>mib*1024*1024)throw Error('持久状态超过历史容量上限');await this.db.adapter.write(next);this.db.data=next;
  });}
  async flush(){await this.queue.onIdle();}
}
