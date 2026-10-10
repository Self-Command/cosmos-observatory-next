import {useEffect,useState} from 'react';
import {Button} from './official/button';
import {Input} from './official/input';
import {Filter,formatTime} from './EvidenceContent';
import type {Controller} from './controller';
import type {Snapshot} from '../core/types';
export function ReplayControl({controller,snapshot,run}:{controller:Controller;snapshot:Snapshot;run:(label:string,action:()=>Promise<unknown>|void)=>void}){
  const frames=controller.historySnapshots(),[index,setIndex]=useState(0),[playing,setPlaying]=useState(false),[speed,setSpeed]=useState('1');
  const active=snapshot.replay?frames.findIndex(frame=>frame.at===snapshot.at):index,current=active<0?index:active;
  const seek=(value:number)=>{const next=Math.max(0,Math.min(frames.length-1,value));setIndex(next);run('打开历史快照',()=>controller.replay(next));};
  useEffect(()=>{if(!playing||!frames.length)return;const timer=setTimeout(()=>{if(current>=frames.length-1){setPlaying(false);return;}seek(current+1);},1000/Number(speed));return()=>clearTimeout(timer);},[playing,speed,current,frames.length]);
  return <div className="replay-control">{!frames.length?<p>尚无历史快照。启用期间按 {String(controller.settings.snapshotSeconds)} 秒采样；采样失败见底栏提示。</p>:<><p>{snapshot.replay?formatTime(snapshot.at,String(controller.settings.timezone)):'实时观测'} · {frames.length} 个保留快照</p>{snapshot.replay&&snapshot.spatialStatus==='missing'&&<p role="status">旧快照没有空间坐标，使用初始构图；历史数据与实时布局分开。</p>}<Input type="range" aria-label="历史快照" min={0} max={frames.length-1} value={current} onChange={event=>{setPlaying(false);seek(Number(event.target.value));}}/><div className="action-row"><Button size="xs" disabled={current<=0} onClick={()=>seek(current-1)}>上一快照</Button><Button size="xs" onClick={()=>{if(!snapshot.replay)seek(current);setPlaying(!playing);}}>{playing?'暂停播放':'播放历史'}</Button><Button size="xs" disabled={current>=frames.length-1} onClick={()=>seek(current+1)}>下一快照</Button><Filter label="播放速度" value={speed} set={value=>setSpeed(value||'1')} values={[['0.5','0.5 倍'],['1','1 倍'],['2','2 倍'],['4','4 倍']]}/><Button size="xs" variant="outline" onClick={()=>{setPlaying(false);run('返回实时',()=>controller.live());}}>返回实时</Button></div><small>范围 {formatTime(frames[0].at,String(controller.settings.timezone))} — {formatTime(frames.at(-1)!.at,String(controller.settings.timezone))}。容量与保留期限会移除更早记录。历史浏览不运行检查。</small></>}</div>;
}
