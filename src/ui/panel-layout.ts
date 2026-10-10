import type {PanelLayout} from '../core/types';
import type {Settings} from '../core/settings';
export interface PanelArea {width:number;height:number;top:number;bottom:number}
export const panelIds=[['events','事件轨迹'],['worlds','世界地图'],['coverage','链接覆盖'],['heat','活动热图'],['checks','检查结果'],['relations','当前关系']] as const;
export function initialPanel(index:number,area:PanelArea,settings:Settings):PanelLayout{
  const margin=Math.min(Number(settings.panelMargin),Math.max(0,area.width/10)),gap=Number(settings.panelGap),minimum=Number(settings.panelMinWidth),available=Math.max(1,area.width-margin*2);
  const columns=[6,3,2,1].find(count=>available>=minimum*count+gap*(count-1))??1;
  const width=Math.max(1,(available-gap*(columns-1))/columns),rows=Math.ceil(panelIds.length/columns),height=Math.min(Number(settings.panelHeight),Math.max(30,(area.height-area.top-area.bottom-gap*(rows-1))/rows));
  return {x:margin+(index%columns)*(width+gap),y:Math.max(area.top,area.height-area.bottom-(height+gap)*(rows-Math.floor(index/columns))+gap),width:Math.max(100,width),height:Math.max(80,height),z:index+1,visible:true,locked:false,maximized:false,automatic:true};
}
export function clampPanel(layout:PanelLayout,area:PanelArea,margin=0){const availableHeight=Math.max(1,area.height-area.top-area.bottom),width=Math.max(1,Math.min(layout.width,area.width-margin*2)),height=Math.max(1,Math.min(layout.height,availableHeight-margin*2));return {...layout,width,height,x:Math.max(margin,Math.min(layout.x,area.width-width-margin)),y:Math.max(area.top+margin,Math.min(layout.y,area.height-area.bottom-height-margin))};}
export function renderedPanel(layout:PanelLayout,index:number,area:PanelArea,settings:Settings){const automatic=layout.automatic?{...initialPanel(index,area,settings),z:layout.z,locked:layout.locked,visible:layout.visible,maximized:layout.maximized,previous:layout.previous}:layout;const limited={...automatic,width:Math.min(automatic.width,Number(settings.panelMaxWidth)),height:Math.min(automatic.height,Number(settings.panelMaxHeight))};return layout.maximized?clampPanel({...automatic,x:8,y:area.top+8,width:area.width-16,height:area.height-area.top-area.bottom-16},area):clampPanel(limited,area);}
