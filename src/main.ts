import { FileSystemAdapter, type WorkspaceLeaf } from 'obsidian';
import path from 'node:path';
import CosmographPlugin from './framework/cosmograph/obsidian/plugin';
import { Coordinator } from './host/Coordinator';
export default class ObservatoryPlugin extends CosmographPlugin {
  private coordinator:Coordinator|undefined;private coordinatorReady:Promise<Coordinator>|undefined;private consumers=0;
  async acquireCoordinator(){if(!this.coordinator){const adapter=this.app.vault.adapter;if(!(adapter instanceof FileSystemAdapter))throw Error('该插件仅支持 Obsidian 桌面文件库');const coordinator=new Coordinator(this.app,path.join(adapter.getBasePath(),this.manifest.dir??`${this.app.vault.configDir}/plugins/${this.manifest.id}`,'state'));this.coordinator=coordinator;this.coordinatorReady=coordinator.start().then(()=>coordinator).catch(async error=>{await coordinator.destroy();if(this.coordinator===coordinator){this.coordinator=undefined;this.coordinatorReady=undefined;}throw error;});}this.consumers++;try{return await this.coordinatorReady!;}catch(error){this.consumers=Math.max(0,this.consumers-1);throw error;}}
  async releaseCoordinator(){this.consumers=Math.max(0,this.consumers-1);if(!this.consumers&&this.coordinator){const coordinator=this.coordinator;this.coordinator=undefined;await coordinator.destroy();}}
  onunload(){if(this.coordinator){void this.coordinator.destroy();this.coordinator=undefined;}this.consumers=0;}
}
