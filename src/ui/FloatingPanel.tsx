import {Rnd} from 'react-rnd';
import {useEffect,useRef,useState} from 'react';
import {Lock,Unlock,Maximize2,Minimize2,X} from 'lucide-react';
import {Card,CardHeader,CardTitle,CardContent} from './official/card';
import {Button} from './official/button';
import {Tooltip,TooltipTrigger,TooltipContent} from './official/tooltip';
import {panelVector} from '../scene/reference';
import {renderedPanel,type PanelArea} from './panel-layout';
import type {PanelLayout} from '../core/types';
import type {Settings} from '../core/settings';
const directions=['top','right','bottom','left','topRight','bottomRight','bottomLeft','topLeft'];
const classes=Object.fromEntries(directions.map(direction=>[direction,`panel-resize-${direction}`]));
const handles={top:{top:0,height:6},right:{right:0,width:6},bottom:{bottom:0,height:6},left:{left:0,width:6},topRight:{top:0,right:0,width:12,height:12},bottomRight:{bottom:0,right:0,width:12,height:12},bottomLeft:{bottom:0,left:0,width:12,height:12},topLeft:{top:0,left:0,width:12,height:12}};
export function FloatingPanel({id,title,index,layout,area,settings,save,focus,children}:{id:string;title:string;index:number;layout:PanelLayout;area:PanelArea;settings:Settings;save:(layout:PanelLayout)=>void;focus:()=>void;children:React.ReactNode}){
  const actual=renderedPanel(layout,index,area,settings),locked=!!settings.panelsLocked||layout.locked,max=layout.maximized;
  const card=useRef<HTMLDivElement>(null),[measured,setMeasured]=useState({width:actual.width,height:actual.height});
  useEffect(()=>{if(!card.current)return;const observer=new ResizeObserver(entries=>{const {width,height}=entries[0].contentRect;setMeasured({width,height});});observer.observe(card.current);return()=>observer.disconnect();},[]);
  const previous=layout.automatic?actual:layout;
  const toggleMax=()=>save({...layout,maximized:!max,previous:max?undefined:{x:previous.x,y:previous.y,width:Math.max(100,previous.width),height:Math.max(80,previous.height)},...(max&&layout.previous?layout.previous:{})});
  return <Rnd bounds="parent" enableUserSelectHack={false} resizeHandleClasses={classes} resizeHandleStyles={handles} dragHandleClassName="panel-drag" cancel="button,input,textarea,select,[role=switch],[role=slider],[role=combobox]" position={{x:actual.x,y:actual.y-area.top}} size={{width:actual.width,height:actual.height}} minWidth={Math.min(Number(settings.panelMinWidth),Number(settings.panelMaxWidth),area.width)} minHeight={Math.min(Number(settings.panelMinHeight),Number(settings.panelMaxHeight),Math.max(1,area.height-area.top-area.bottom))} maxWidth={Math.min(Number(settings.panelMaxWidth),area.width)} maxHeight={Math.min(Number(settings.panelMaxHeight),Math.max(1,area.height-area.top-area.bottom))} disableDragging={locked||max} enableResizing={!locked&&!max} style={{zIndex:layout.z,pointerEvents:'auto'}} onDragStop={(_,data)=>save({...layout,x:data.x,y:data.y+area.top,automatic:false})} onResizeStop={(_,__,element,___,position)=>save({...layout,width:Math.max(100,element.offsetWidth),height:Math.max(80,element.offsetHeight),x:position.x,y:position.y+area.top,automatic:false})} onMouseDown={focus}>
    <Card ref={card} className="observatory-panel" data-panel={id}><div className="reference-panel-vector" dangerouslySetInnerHTML={{__html:panelVector(index,title,measured.width,measured.height)}}/><CardHeader className="panel-drag"><CardTitle title={title}>{title}</CardTitle><div className="panel-actions">
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-xs" aria-label={`${title}锁定`} onClick={()=>save({...layout,locked:!layout.locked})}>{layout.locked?<Lock size={11}/>:<Unlock size={11}/>}</Button></TooltipTrigger><TooltipContent>锁定或解除此面板</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-xs" aria-label={`${title}最大化`} onClick={toggleMax}>{max?<Minimize2 size={11}/>:<Maximize2 size={11}/>}</Button></TooltipTrigger><TooltipContent>{max?'恢复面板':'最大化面板'}</TooltipContent></Tooltip>
      <Tooltip><TooltipTrigger asChild><Button variant="ghost" size="icon-xs" aria-label={`${title}隐藏`} onClick={()=>save({...layout,visible:false})}><X size={11}/></Button></TooltipTrigger><TooltipContent>隐藏；底栏可恢复</TooltipContent></Tooltip>
    </div></CardHeader><CardContent>{children}</CardContent></Card>
  </Rnd>;
}
