import type { Settings } from '../core/settings';
import type { Snapshot, PersistentState, WorldLayout, PanelLayout } from '../core/types';
export interface Controller {
  state:PersistentState;settings:Settings;getSnapshot():Snapshot;subscribe(listener:()=>void):()=>void;
  updateSettings(input:Record<string,unknown>):Promise<void>;updateWorld(id:string,patch:Partial<WorldLayout>):Promise<void>;updatePanel(id:string,layout:PanelLayout):Promise<void>;
  refresh():Promise<unknown>;historySnapshots():Snapshot[];replay(index:number):void;live():Promise<void>;
}
