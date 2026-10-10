import { createRoot, type Root } from 'react-dom/client';
import type { WorkspaceLeaf } from 'obsidian';
import { CosmographView as UpstreamView } from '../framework/cosmograph/obsidian/CosmographView';
import type ObservatoryPlugin from '../main';
import { Dashboard } from '../ui/Dashboard';
import { PortalContext } from '../ui/PortalContext';
import theme from '../ui/theme.css';
import type { Coordinator } from './Coordinator';
export const VIEW_TYPE_COSMOGRAPH='cosmos-observatory-next-view';
export class CosmographView extends UpstreamView {
  private reactRoot:Root|undefined;private engineController:Coordinator|undefined;private productPlugin:ObservatoryPlugin;
  constructor(leaf:WorkspaceLeaf,plugin:ObservatoryPlugin){super(leaf,plugin);this.productPlugin=plugin;}
  override getViewType(){return VIEW_TYPE_COSMOGRAPH;}
  override getDisplayText(){return '宇宙观测台';}
  override getIcon(){return 'orbit';}
  override async onOpen(){
    this.contentEl.empty();this.contentEl.addClass('cosmos-observatory-host');const host=this.contentEl.createDiv({cls:'cosmos-shadow-host'});const shadow=host.attachShadow({mode:'open'});const style=document.createElement('style');style.textContent=theme;shadow.append(style);const mount=document.createElement('div');mount.className='cosmos-mount';shadow.append(mount);const portal=document.createElement('div');portal.className='cosmos-portal dark';shadow.append(portal);
    this.engineController=await this.productPlugin.acquireCoordinator();const assetPath=`${this.productPlugin.manifest.dir}/assets/spider.glb`;const spiderURL=this.app.vault.adapter.getResourcePath(assetPath);
    this.reactRoot=createRoot(mount);this.reactRoot.render(<PortalContext.Provider value={portal}><Dashboard controller={this.engineController} spiderURL={spiderURL} openFile={path=>{void this.app.workspace.openLinkText(path,'',true);}}/></PortalContext.Provider>);
  }
  override refreshGraph(){void this.engineController?.refresh();}
  override applySettings(){void this.engineController?.refresh();}
  override async onClose(){this.reactRoot?.unmount();this.reactRoot=undefined;await this.productPlugin.releaseCoordinator();this.engineController=undefined;this.contentEl.empty();}
}
