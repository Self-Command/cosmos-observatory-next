import type { Settings } from '../core/settings';
import type { Snapshot, PersistentState, WorldLayout, PanelLayout, NodeLayout, SpatialState } from '../core/types';
export interface Controller {
  state:PersistentState;settings:Settings;getSnapshot():Snapshot;subscribe(listener:()=>void):()=>void;
  updateSettings(input:Record<string,unknown>):Promise<void>;updateWorld(id:string,patch:Partial<WorldLayout>):Promise<void>;updatePanel(id:string,layout:PanelLayout):Promise<void>;
  refresh():Promise<unknown>;historySnapshots():Snapshot[];replay(index:number):void;live():Promise<void>;
  getLayoutState?():SpatialState;updateNode?(id:string,layout:NodeLayout):Promise<void>;recordPositions?(nodes:Record<string,NodeLayout>):void;
  inspectFile?(id:string):Promise<void>;resetLayouts?(scope:'worlds'|'panels'|'all'):Promise<void>;applyConfiguration?(text:string):Promise<void>;confirmAsset?(id:string,confirmed:boolean):Promise<void>;
}
