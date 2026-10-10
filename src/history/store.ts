import { Low, Memory } from 'lowdb';
import PQueue from 'p-queue';
import type { Snapshot, PersistentState } from '../core/types';
export interface HistoryData { state:PersistentState; snapshots:Snapshot[] }
export interface HistoryAdapter { read():Promise<HistoryData|null>;write(value:HistoryData):Promise<void> }
export class HistoryStore {
  private db:Low<HistoryData>;private queue=new PQueue({concurrency:1});
  constructor(state:PersistentState,adapter:HistoryAdapter=new Memory<HistoryData>()){this.db=new Low(adapter,{state,snapshots:[]});}
  async load(){await this.db.read();return this.db.data;}
  snapshots(){return this.db.data.snapshots;}
  save(state:PersistentState,snapshot:Snapshot|undefined,days:number,mib:number){return this.queue.add(async()=>{
    this.db.data.state=structuredClone(state);if(snapshot)this.db.data.snapshots.push(structuredClone(snapshot));
    const cutoff=Date.now()-days*86400000;this.db.data.snapshots=this.db.data.snapshots.filter(s=>s.at>=cutoff);
    const size=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).byteLength;
    while(this.db.data.snapshots.length&&size(this.db.data)>mib*1024*1024)this.db.data.snapshots.shift();
    if(size(this.db.data)>mib*1024*1024)throw Error('持久状态超过历史容量上限');await this.db.write();
  });}
  async flush(){await this.queue.onIdle();}
}
