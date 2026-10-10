import Ajv from 'ajv';
import type { WorldLayout,PanelLayout,NodeLayout,PersistentState } from './types';
import { validateSettings, assertSettings } from './settings';
const triple={type:'array',minItems:3,maxItems:3,items:{type:'number',minimum:-10000,maximum:10000}};
const world={type:'object',additionalProperties:false,required:['position','rotation','locked'],properties:{position:triple,rotation:triple,locked:{type:'boolean'},color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},role:{type:'string',maxLength:256},radius:{type:'number',minimum:.3,maximum:8},radiusAutomatic:{type:'boolean'},centerPath:{type:'string',maxLength:1024},confirmed:{type:'boolean'}}};
const rectangle={type:'object',additionalProperties:false,required:['x','y','width','height'],properties:{x:{type:'number',minimum:-10000,maximum:10000},y:{type:'number',minimum:-10000,maximum:10000},width:{type:'number',minimum:100,maximum:10000},height:{type:'number',minimum:80,maximum:10000}}};
const panel={type:'object',additionalProperties:false,required:['x','y','width','height','z','visible','locked','maximized'],properties:{...rectangle.properties,z:{type:'integer',minimum:0,maximum:1000000},visible:{type:'boolean'},locked:{type:'boolean'},maximized:{type:'boolean'},automatic:{type:'boolean'},previous:rectangle}};
const node={type:'object',additionalProperties:false,required:['position','fixed'],properties:{position:triple,fixed:{type:'boolean'}}};
const ajv=new Ajv({allErrors:true}),checkWorld=ajv.compile(world),checkPanel=ajv.compile(panel),checkNode=ajv.compile(node);
export const validWorld=(value:unknown):value is WorldLayout=>!!checkWorld(value);
export const validPanel=(value:unknown):value is PanelLayout=>!!checkPanel(value);
export const validNode=(value:unknown):value is NodeLayout=>!!checkNode(value);
const record=(value:unknown):value is Record<string,unknown>=>!!value&&typeof value==='object'&&!Array.isArray(value);
export function parseConfiguration(text:string){const data=JSON.parse(text);if(!record(data)||![1,2].includes(Number(data.version))||!record(data.settings))throw Error('配置版本或设置错误');assertSettings(data.settings);const worlds=data.worlds??{},panels=data.panels??{},nodes=data.nodes??{};if(!record(worlds)||!record(panels)||!record(nodes)||!Object.values(worlds).every(validWorld)||!Object.values(panels).every(validPanel)||!Object.values(nodes).every(validNode))throw Error('球体、文件或面板布局契约错误');return {settings:validateSettings(data.settings),worlds:worlds as Record<string,WorldLayout>,panels:panels as Record<string,PanelLayout>,nodes:nodes as Record<string,NodeLayout>};}
/** Migrate this plugin's v1 only; malformed fields are isolated from valid state. */
export function migrateState(value:unknown):PersistentState{
  const data=record(value)&&[1,2].includes(Number(value.schemaVersion))?value:{};
  const filtered=<T>(input:unknown,valid:(value:unknown)=>value is T)=>Object.fromEntries(Object.entries(record(input)?input:{}).filter(([,item])=>valid(item))) as Record<string,T>;
  const state:PersistentState={schemaVersion:2,settings:validateSettings(record(data.settings)?data.settings:{}),identities:filtered(data.identities,(item):item is string=>typeof item==='string'&&item.length>0),worlds:filtered(data.worlds,validWorld),panels:filtered(data.panels,validPanel),nodes:filtered(data.nodes,validNode),assetConfirmations:filtered(data.assetConfirmations,(item):item is boolean=>typeof item==='boolean'),layoutRevision:Number.isSafeInteger(data.layoutRevision)?Number(data.layoutRevision):0};
  const rootId=state.identities['@vault-root'];if(rootId)delete state.worlds[rootId];delete state.identities['@vault-root'];
  return state;
}
