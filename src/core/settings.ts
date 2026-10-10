export type SettingValue = string | number | boolean;
export interface SettingDefinition { group: string; label: string; type: 'number' | 'boolean' | 'string' | 'color' | 'select'; default: SettingValue; min?: number; max?: number; step?: number; options?: string[]; restart?: boolean }
const n=(group:string,label:string,value:number,min:number,max:number,step=1):SettingDefinition=>({group,label,type:'number',default:value,min,max,step});
const b=(group:string,label:string,value:boolean):SettingDefinition=>({group,label,type:'boolean',default:value});
const s=(group:string,label:string,value:string):SettingDefinition=>({group,label,type:'string',default:value});
export const registry = {
  worldRadius:n('世界','默认半径',2.1,.3,8,.1), worldSpacing:n('世界','新世界间距',7,3,20,.5), worldRotation:n('世界','旋转速度',.025,0,.5,.005),
  nodeSize:n('文件节点','文件球大小',2.2,.3,5,.1), centerScale:n('文件节点','中心倍率',2,1,6,.1), floatAmplitude:n('文件节点','悬浮幅度',.035,0,.4,.005), floatSpeed:n('文件节点','悬浮速度',.7,0,5,.1), nodeBudget:n('文件节点','可见文件预算',1400,50,10000,50), labelBudget:n('文件节点','标签预算',14,0,200),
  labelMode:{group:'文件节点',label:'标签模式',type:'select',default:'important',options:['none','important','all']} as SettingDefinition,
  edges:b('关系','显示真实关系',true), edgeOpacity:n('关系','关系透明度',.16,0,1,.01), edgeWidth:n('关系','线宽',1,.5,4,.1), edgeBudget:n('关系','关系预算',3000,0,20000,100), propertyKeys:s('关系','登记属性（逗号分隔）','project,area,parent'), dependencies:b('关系','展示显式依赖',true),
  background:b('背景','宇宙背景',true), backgroundBrightness:n('背景','背景亮度',.18,0,1,.02), stars:b('背景','星点',true), starBrightness:n('背景','星点亮度',.25,0,1,.05), bloom:n('背景','柔光强度',.6,0,1.8,.05), aura:n('背景','球体光晕',.2,0,1,.01), orbits:b('背景','轨道虚影',true), structure:b('背景','目录结构辅助线',false), exposure:n('背景','曝光',.9,.2,2,.05),
  fov:n('镜头与性能','视野',42,20,90), cameraDistance:n('镜头与性能','初始镜头距离',33,8,100), sensitivity:n('镜头与性能','操作灵敏度',.75,.1,3,.05), fps:n('镜头与性能','帧率上限',40,10,60), pixelRatio:n('镜头与性能','像素比上限',1.5,.5,2.5,.1), reducedMotion:b('镜头与性能','减少动画',false), animationPaused:b('镜头与性能','暂停动态',false),
  patrolEnabled:b('蜘蛛与巡查','开启巡查',true), patrolPaused:b('蜘蛛与巡查','暂停巡查',false), patrolInterval:n('蜘蛛与巡查','调度间隔（秒）',1.5,.2,60,.1), revisitSeconds:n('蜘蛛与巡查','同版本复查间隔（秒）',30,1,3600), maxReadKiB:n('蜘蛛与巡查','读取上限（KiB）',1024,4,32768,4), spiderSize:n('蜘蛛与巡查','蜘蛛屏幕尺寸（像素）',96,32,240,4), spiderSpeed:n('蜘蛛与巡查','定位速度',4,.2,20,.2), spiderColor:{...s('蜘蛛与巡查','蜘蛛颜色','#A8E6E3'),type:'color'} as SettingDefinition,
  debounceMs:n('仓库监听','变化合并（毫秒）',1000,100,5000,100), maxWaitMs:n('仓库监听','最大等待（毫秒）',5000,1000,30000,500), include:s('仓库监听','包含前缀（逗号分隔；空为全部）',''), exclude:s('仓库监听','排除前缀（逗号分隔）','.git,.obsidian,.trash'), observePlugins:b('仓库监听','观察插件清单',true),
  schemaPath:s('模型与扩展','Schema 路径','宇宙/演化/脚本/lib/system-schema.json'), enginePath:s('模型与扩展','Engine 路径','宇宙/演化/脚本/lib/system-engine.cjs'), templates:s('模型与扩展','模板目录标识','模板,templates'), scripts:s('模型与扩展','脚本目录标识','脚本,scripts'), extensionPollSeconds:n('模型与扩展','插件清单复查（秒）',30,5,300,5),
  panelMinWidth:n('面板','最小宽度',170,140,600,10), panelMinHeight:n('面板','最小高度',140,100,600,10), panelsLocked:b('面板','锁定全部面板',false), logLimit:n('面板','可见事件数量',200,20,2000,20), heatMinutes:n('面板','热图窗口（分钟）',60,5,1440,5), panelOpacity:n('主题','面板不透明度',.83,.2,1,.01), panelRadius:n('主题','面板圆角',8,0,24), fontSize:n('主题','字号',12,10,20),
  receiverEnabled:b('来源与历史','开启本地来源接收',false), receiverPort:n('来源与历史','接收端口',27148,1024,65535), receiverRate:n('来源与历史','每分钟来源事件上限',120,10,10000,10), eventLimit:n('来源与历史','事件记录上限',5000,100,20000,100), retentionDays:n('来源与历史','历史保留天数',14,1,365), historyMiB:n('来源与历史','总历史容量（MiB）',100,5,1024,5), logCapacityMiB:n('来源与历史','日志容量（MiB；最多总容量的20%）',5,1,128), logFileKiB:n('来源与历史','日志单文件上限（KiB）',256,64,2048,64), snapshotSeconds:n('来源与历史','快照间隔（秒）',30,5,300,5), timezone:s('来源与历史','时区','Asia/Shanghai')
} satisfies Record<string, SettingDefinition>;
export type Settings = Record<keyof typeof registry, SettingValue>;
export const defaults=():Settings=>Object.fromEntries(Object.entries(registry).map(([key,def])=>[key,def.default])) as Settings;
export function validateSettings(input:Record<string,unknown>):Settings {
  const output=defaults();
  for(const [key,def] of Object.entries(registry)){
    const value=input[key];
    if(def.type==='number' && typeof value==='number' && Number.isFinite(value) && value>=def.min! && value<=def.max!) output[key as keyof Settings]=value;
    else if(def.type==='boolean' && typeof value==='boolean') output[key as keyof Settings]=value;
    else if(['string','color','select'].includes(def.type) && typeof value==='string' && value.length<=4096 && (!def.options || def.options.includes(value)) && (def.type!=='color' || /^#[0-9a-f]{6}$/i.test(value))) output[key as keyof Settings]=value;
  }
  try{new Intl.DateTimeFormat('zh-CN',{timeZone:String(output.timezone)});}catch{output.timezone=registry.timezone.default;}
  output.maxWaitMs=Math.max(Number(output.maxWaitMs),Number(output.debounceMs));
  return output;
}
export const splitList=(value:SettingValue)=>String(value).split(',').map(x=>x.trim()).filter(Boolean);
export const semanticPresets:Record<string,{color:string;role:string}>={太阳:{color:'#F5C578',role:'创造、执行、成果'},月亮:{color:'#B7C9EE',role:'理解、认知、检验'},地球:{color:'#72C8F5',role:'现实、生活、成长'},星云:{color:'#B299FF',role:'输入、灵感、可能性'},银河:{color:'#A8E6E3',role:'导航、索引、观测'},宇宙:{color:'#C4B5FD',role:'规则、系统、演化'},黑洞:{color:'#71809B',role:'沉积、归档、再激活'}};
