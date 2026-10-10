import Ajv from 'ajv';
import type { WorldLayout,PanelLayout } from './types';
const triple={type:'array',minItems:3,maxItems:3,items:{type:'number',minimum:-10000,maximum:10000}};
const world={type:'object',additionalProperties:false,required:['position','rotation','locked'],properties:{position:triple,rotation:triple,locked:{type:'boolean'},color:{type:'string',pattern:'^#[0-9a-fA-F]{6}$'},role:{type:'string',maxLength:256},radius:{type:'number',minimum:.3,maximum:8},centerPath:{type:'string',maxLength:1024},confirmed:{type:'boolean'}}};
const rectangle={type:'object',additionalProperties:false,required:['x','y','width','height'],properties:{x:{type:'number',minimum:-10000,maximum:10000},y:{type:'number',minimum:-10000,maximum:10000},width:{type:'number',minimum:100,maximum:10000},height:{type:'number',minimum:80,maximum:10000}}};
const panel={type:'object',additionalProperties:false,required:['x','y','width','height','z','visible','locked','maximized'],properties:{...rectangle.properties,z:{type:'integer',minimum:0,maximum:1000000},visible:{type:'boolean'},locked:{type:'boolean'},maximized:{type:'boolean'},previous:rectangle}};
const ajv=new Ajv({allErrors:true}),checkWorld=ajv.compile(world),checkPanel=ajv.compile(panel);
export const validWorld=(value:unknown):value is WorldLayout=>!!checkWorld(value);
export const validPanel=(value:unknown):value is PanelLayout=>!!checkPanel(value);
export function parseConfiguration(text:string){const data=JSON.parse(text);if(data.version!==1||!data.settings||typeof data.settings!=='object')throw Error('配置版本或设置错误');const worlds=data.worlds??{},panels=data.panels??{};if(!Object.values(worlds).every(validWorld)||!Object.values(panels).every(validPanel))throw Error('球体或面板布局契约错误');return {settings:data.settings as Record<string,unknown>,worlds:worlds as Record<string,WorldLayout>,panels:panels as Record<string,PanelLayout>};}
