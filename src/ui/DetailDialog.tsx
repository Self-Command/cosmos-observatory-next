import {Dialog,DialogContent,DialogHeader,DialogTitle,DialogDescription} from './official/dialog';
import {Button} from './official/button';
import {EventBrowser,EventEvidence,FileBrowser,FileEvidence,WorldMap,coverageData,RelationRows,ChecksBrowser,SystemEvidence,SessionEvidence,type Detail,type EvidenceActions} from './EvidenceContent';
import {ReplayControl} from './ReplayControl';
import type {Controller} from './controller';
import type {Snapshot} from '../core/types';
export function DetailDialog({value,close,snapshot,controller,actions,worldSettings}:{value:Detail|null;close:()=>void;snapshot:Snapshot;controller:Controller;actions:EvidenceActions;worldSettings:()=>void}){
  const world=value?.kind==='world'?snapshot.worlds.find(world=>world.id===value.id):undefined,file=value?.kind==='file'?snapshot.files.find(file=>file.id===value.id):undefined;
  const titles:Record<Detail['kind'],string>={entities:'世界与文件浏览',world:world?.name??'库根文件',file:file?.name??'文件证据',events:'事件轨迹',event:'事件证据',coverage:'链接覆盖明细',checks:'完整检查结果',system:'模型与扩展系统',sessions:'来源、会话与工具',replay:'历史回放'};
  const body=()=>{if(!value)return null;switch(value.kind){
    case 'entities':return <div className="entity-browser"><WorldMap snapshot={snapshot} controller={controller} actions={actions}/><FileBrowser files={snapshot.files} actions={actions}/></div>;
    case 'world':return <div className="evidence-browser">{world&&<><p>{world.role} · {world.count} 文件 · {world.coverage}</p><div className="action-row"><Button size="xs" onClick={()=>actions.world(world.id)}>定位世界</Button><Button size="xs" variant="outline" onClick={worldSettings}>配置中心 / 颜色 / 职责</Button></div></>}<FileBrowser files={snapshot.files.filter(file=>world?file.worldId===world.id:file.worldId===null)} actions={actions}/></div>;
    case 'file':return <FileEvidence id={value.id!} snapshot={snapshot} controller={controller} actions={actions}/>;
    case 'events':return <EventBrowser snapshot={snapshot} settings={controller.settings} actions={actions} ids={value.ids}/>;
    case 'event':{const event=snapshot.events.find(event=>event.id===value.id);return event?<EventEvidence event={event} snapshot={snapshot} actions={actions} timezone={String(controller.settings.timezone)}/>:<p>该记录已超出当前日志保留范围。</p>;}
    case 'coverage':{const data=coverageData(snapshot);if(value.mode==='linked'||value.mode==='isolated')return <FileBrowser files={value.mode==='isolated'?data.isolated:snapshot.files.filter(file=>data.linked.has(file.id))} actions={actions}/>;if(value.mode==='unresolved')return <div className="evidence-detail">{snapshot.unresolved?.map(link=><div key={link.id}><p>{link.path} → {link.target} · {link.kind}</p><pre>{link.evidence}</pre><Button size="xs" onClick={()=>actions.open(link.path)}>打开来源文件</Button></div>)}{!snapshot.unresolved?.length&&<p>当前没有未解析链接。</p>}</div>;return <RelationRows relations={value.mode==='cross'?data.cross:snapshot.relations} snapshot={snapshot} actions={actions}/>;}
    case 'checks':return <ChecksBrowser snapshot={snapshot} controller={controller} actions={actions}/>;
    case 'system':return <SystemEvidence snapshot={snapshot} controller={controller} actions={actions}/>;
    case 'sessions':return <SessionEvidence snapshot={snapshot} controller={controller} actions={actions}/>;
    case 'replay':return <ReplayControl controller={controller} snapshot={snapshot} run={actions.run}/>;
  }};
  return <Dialog open={!!value} onOpenChange={open=>{if(!open)close();}}><DialogContent className="evidence-dialog"><DialogHeader><DialogTitle>{value?.title??(value?titles[value.kind]:'证据')}</DialogTitle><DialogDescription>{snapshot.replay?'历史采样数据':'当前知识库观测'} · 可查看记录与文件证据</DialogDescription></DialogHeader><div className="detail-body" key={`${value?.kind}:${value?.id??''}:${value?.mode??''}`}>{body()}</div></DialogContent></Dialog>;
}
