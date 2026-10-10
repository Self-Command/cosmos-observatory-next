import { FileSystemAdapter, Notice } from 'obsidian';
import path from 'node:path';
import CosmographPlugin from './framework/cosmograph/obsidian/plugin';
import { Coordinator } from './host/Coordinator';
export default class ObservatoryPlugin extends CosmographPlugin {
  private coordinator:Coordinator|undefined;private coordinatorReady:Promise<Coordinator>|undefined;private consumers=0;
  override async onload(){await super.onload();this.app.workspace.onLayoutReady(()=>{void this.ensureCoordinator().catch(error=>new Notice(`宇宙观测台启动失败: ${String(error)}`));});}
  private async ensureCoordinator(){if(!this.coordinator){const adapter=this.app.vault.adapter;if(!(adapter instanceof FileSystemAdapter))throw Error('该插件仅支持 Obsidian 桌面文件库');const coordinator=new Coordinator(this.app,path.join(adapter.getBasePath(),this.manifest.dir??`${this.app.vault.configDir}/plugins/${this.manifest.id}`,'state'));this.coordinator=coordinator;this.coordinatorReady=coordinator.start().then(()=>coordinator).catch(async error=>{await coordinator.destroy();if(this.coordinator===coordinator){this.coordinator=undefined;this.coordinatorReady=undefined;}throw error;});}return this.coordinatorReady!;}
  async acquireCoordinator(){const coordinator=await this.ensureCoordinator();this.consumers++;return coordinator;}
  async releaseCoordinator(){this.consumers=Math.max(0,this.consumers-1);}
  onunload(){if(this.coordinator){void this.coordinator.destroy();this.coordinator=undefined;}this.consumers=0;}
}
