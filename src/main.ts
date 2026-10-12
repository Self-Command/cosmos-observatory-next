import { FileSystemAdapter } from 'obsidian';
import path from 'node:path';
import CosmographPlugin from './framework/cosmograph/obsidian/plugin';
import { Coordinator } from './host/Coordinator';
export default class ObservatoryPlugin extends CosmographPlugin {
  private coordinator:Coordinator|undefined;private coordinatorReady:Promise<Coordinator>|undefined;private closing:Promise<void>|undefined;private consumers=new Set<object>();private unloaded=false;
  override async onload(){this.unloaded=false;await super.onload();}
  private async ensureCoordinator(){if(!this.coordinator){const adapter=this.app.vault.adapter;if(!(adapter instanceof FileSystemAdapter))throw Error('该插件仅支持 Obsidian 桌面文件库');const coordinator=new Coordinator(this.app,path.join(adapter.getBasePath(),this.manifest.dir??`${this.app.vault.configDir}/plugins/${this.manifest.id}`,'state'));this.coordinator=coordinator;this.coordinatorReady=coordinator.start().then(()=>coordinator).catch(async error=>{await coordinator.destroy();if(this.coordinator===coordinator){this.coordinator=undefined;this.coordinatorReady=undefined;}throw error;});}return this.coordinatorReady!;}
  async acquireCoordinator(owner:object){this.consumers.add(owner);await this.closing;if(this.unloaded||!this.consumers.has(owner))throw Error('观测面板已经关闭');return this.ensureCoordinator();}
  async releaseCoordinator(owner:object){this.consumers.delete(owner);if(!this.consumers.size)await this.stopCoordinator();}
  private stopCoordinator(){if(!this.coordinator)return this.closing;const coordinator=this.coordinator;this.coordinator=undefined;this.coordinatorReady=undefined;const closing:Promise<void>=coordinator.destroy().finally(()=>{if(this.closing===closing)this.closing=undefined;});this.closing=closing;return closing;}
  onunload(){this.unloaded=true;this.consumers.clear();void this.stopCoordinator();}
}
