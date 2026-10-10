import { PluginSettingTab, type App } from 'obsidian';
import { createRoot, type Root } from 'react-dom/client';
import { Button } from '../ui/official/button';
import theme from '../ui/theme.css';
export { DEFAULT_SETTINGS, type CosmographSettings, type SettingsController } from '../framework/cosmograph/obsidian/settings';
import type { SettingsController } from '../framework/cosmograph/obsidian/settings';
export class CosmographSettingTab extends PluginSettingTab {
  private root:Root|undefined;
  constructor(app:App,private controller:SettingsController){super(app,controller);}
  display(){this.root?.unmount();this.containerEl.empty();const shadow=this.containerEl.createDiv({cls:'cosmos-native-settings'}).attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=theme;shadow.append(style);const mount=document.createElement('div');mount.className='cosmos-portal dark native-settings-portal';shadow.append(mount);this.root=createRoot(mount);this.root.render(<div className="native-settings"><h2>宇宙观测台</h2><p>世界、文件节点、关系、面板、蜘蛛、巡查、来源和历史均可在控制台右上角设置中配置。</p><Button onClick={()=>{void(async()=>{await (this.controller as any).activateView();(this.app as any).setting.close();})();}}>打开宇宙观测台</Button></div>);}
  hide(){this.root?.unmount();this.root=undefined;}
}
