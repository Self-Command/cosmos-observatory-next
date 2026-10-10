import { JSONFile } from 'lowdb/node';
import { open, mkdir, stat, readFile, writeFile, rename } from 'node:fs/promises';
import {gzipSync,gunzipSync} from 'node:zlib';
import path from 'node:path';
import type { HistoryAdapter, HistoryData } from './store';
import {defaults} from '../core/settings';
/** Bounded recovery files live only inside this plugin's state directory. */
export class RecoveringHistoryAdapter implements HistoryAdapter {
  private primary:JSONFile<HistoryData>;
  constructor(private directory:string,private reserveBytes:()=>number,private report:(message:string)=>void){this.primary=new JSONFile(path.join(directory,'history.json'));}
  async read(){
    try{const value=await this.primary.read();if(value&&(!Array.isArray(value.snapshots)||!value.state||typeof value.state!=='object'))throw Error('历史状态契约失配');return value;}
    catch(error){
      await this.preserveCorrupt();this.report(`历史损坏，保留受容量限制的副本: ${String(error)}`);
      try{const compressed=await readFile(path.join(this.directory,'history.recovery.gz'));if(compressed.byteLength>this.reserveBytes()/2)throw Error('恢复副本超过容量');const saved=JSON.parse(gunzipSync(compressed,{maxOutputLength:Math.max(65536,this.reserveBytes()*20)}).toString('utf8')) as HistoryData;if(saved?.state&&Array.isArray(saved.snapshots)){saved.state.settings={...defaults(),...saved.state.settings};this.report('已从上次有效状态恢复；损坏区间的过程未知');return saved;}}catch{/* The corrupt primary is preserved even when recovery is also damaged. */}
      return null;
    }
  }
  private async preserveCorrupt(){
    const limit=Math.max(0,Math.floor(this.reserveBytes()/2));if(!limit)return;
    try{await mkdir(this.directory,{recursive:true});const source=await open(path.join(this.directory,'history.json'),'r');try{const size=Math.min((await source.stat()).size,limit),buffer=Buffer.alloc(size);await source.read(buffer,0,size,0);const target=await open(path.join(this.directory,'history.corrupt'),'w');try{await target.write(buffer);}finally{await target.close();}}finally{await source.close();}}catch(error){this.report(`损坏历史副本保存失败: ${String(error)}`);}
  }
  async write(value:HistoryData){
    // The primary write is atomic through lowdb's JSONFile. Failure leaves valid memory state intact.
    await this.primary.write(value);
    const settingsDefaults:Record<string,unknown>=defaults(),backup:HistoryData={state:{...value.state,settings:Object.fromEntries(Object.entries(value.state.settings).filter(([key,setting])=>setting!==settingsDefaults[key]))},snapshots:[]},limit=Math.floor(this.reserveBytes()/2),compressed=gzipSync(JSON.stringify(backup));
    if(compressed.byteLength<=limit){try{const staged=path.join(this.directory,'history.recovery.tmp');await writeFile(staged,compressed);await rename(staged,path.join(this.directory,'history.recovery.gz'));}catch(error){this.report(`主状态已保存，恢复副本写入失败: ${String(error)}`);}}
    else this.report('恢复副本容量不足；主状态已保存');
    try{const corrupted=path.join(this.directory,'history.corrupt'),info=await stat(corrupted);if(info.size>limit){const handle=await open(corrupted,'r+');try{await handle.truncate(limit);}finally{await handle.close();}}}catch{/* No corrupt copy is the normal case. */}
  }
}
