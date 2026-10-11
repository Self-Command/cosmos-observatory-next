import source from '../../docs/assets/dashboard-spheres-v2.svg';
import type {Settings} from '../core/settings';

export interface ShapeReference {name:string;color:string;x:number;y:number;radius:number;subtitle:string;points:{x:number;y:number;size:number;opacity:number}[];branches:[number,number,number,number][];orbits:{rx:number;ry:number;angle:number;opacity:number}[]}
let cache:Map<string,ShapeReference>|undefined;
let vectorDocument:Document|undefined;
let background:string|undefined;
function referenceDocument(){return vectorDocument??=new DOMParser().parseFromString(source,'image/svg+xml');}
/** Read the approved vector's layout only. Demo IDs, links and numbers never enter the vault model. */
export function shapeReferences(){
  if(cache)return cache;
  const document=referenceDocument();
  cache=new Map();
  for(const group of document.querySelectorAll('g[data-world]')){
    const xy=group.getAttribute('transform')!.match(/translate\(([-\d.]+)\s+([-\d.]+)\)/)!;
    const outline=[...group.children].find(element=>element.tagName==='circle'&&element.getAttribute('fill')==='none'&&!element.hasAttribute('filter'))!;
    const title=group.querySelector('.world-name')!,name=group.getAttribute('data-world')!;
    const points=[...group.querySelectorAll('circle[id]')].map(point=>({x:Number(point.getAttribute('cx')),y:Number(point.getAttribute('cy')),size:Number(point.getAttribute('r')),opacity:Number(point.getAttribute('opacity'))}));
    const branches=[...group.querySelectorAll('path[data-kind]')].flatMap(path=>{const values=path.getAttribute('d')?.match(/[-\d.]+/g)?.map(Number);return values?.length===4?[values as [number,number,number,number]]:[];});
    const orbits=[...group.querySelectorAll(':scope > ellipse')].map(ellipse=>({rx:Number(ellipse.getAttribute('rx')),ry:Number(ellipse.getAttribute('ry')),angle:Number(ellipse.getAttribute('transform')?.match(/[-\d.]+/)?.[0]??0),opacity:Number(ellipse.getAttribute('opacity'))}));
    cache.set(name,{name,color:title.getAttribute('fill')!,x:Number(xy[1]),y:Number(xy[2]),radius:Number(outline.getAttribute('r')),subtitle:group.querySelector('text.micro[letter-spacing]')?.textContent??'',points,branches,orbits});
  }
  return cache;
}
export function spaceStops(){return [...referenceDocument().querySelectorAll('#space stop')].map(stop=>[stop.getAttribute('offset')!,stop.getAttribute('stop-color')!] as const);}
export function spaceVector(){if(background)return background;const document=referenceDocument();return background=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1560 1120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${document.querySelector('defs')!.outerHTML}<rect width="1560" height="1120" fill="url(#space)"/>${document.querySelector('#decorative-background')!.outerHTML}</svg>`;}
export function configuredSpace(settings:Settings){const document=new DOMParser().parseFromString(spaceVector(),'image/svg+xml'),gradient=Number(settings.backgroundGradient),base=[3,6,9];for(const stop of document.querySelectorAll('#space stop')){const hex=stop.getAttribute('stop-color')!.slice(1),rgb=[0,2,4].map((offset,index)=>Math.max(0,Math.min(255,Math.round(base[index]+(parseInt(hex.slice(offset,offset+2),16)-base[index])*gradient))));stop.setAttribute('stop-color','#'+rgb.map(value=>value.toString(16).padStart(2,'0')).join(''));}const stars=document.querySelector('#decorative-background')!,points=[...stars.querySelectorAll('circle')],density=Number(settings.starDensity);for(const [index,point] of points.entries()){if(density<1&&(index%10)/10>=density)point.remove();if(density>1&&(index%10)/10<density-1){const clone=point.cloneNode(true) as Element;clone.setAttribute('cx',String((Number(point.getAttribute('cx'))+487)%1560));clone.setAttribute('cy',String((Number(point.getAttribute('cy'))+293)%1120));stars.append(clone);}}stars.setAttribute('opacity',String(settings.stars?Number(settings.starBrightness)/.25:0));return document.documentElement.outerHTML;}
export function chromeVector(worlds:number,model:string){const document=referenceDocument(),nodes=[...document.documentElement.children],start=nodes.findIndex(node=>node.tagName==='rect'&&node.getAttribute('height')==='57'),end=nodes.findIndex(node=>node.id==='cross-world-links');const content=nodes.slice(start,end).map(node=>node.cloneNode(true) as Element);for(const element of content){const texts=element.tagName==='text'?[element]:[...element.querySelectorAll('text')];for(const text of texts){const value=text.textContent??'';if(value.includes('视觉稿'))text.textContent='○ LOCAL / READ ONLY';if(value==='7 WORLDS')text.textContent=`${worlds} WORLDS`;if(value==='MODEL v3')text.textContent=`MODEL ${model||'—'}`;if(value==='VISUAL DRAFT 02')text.textContent='LOCAL OBSERVATION';if(value==='七世界 · 球状知识图谱')text.textContent=`${worlds===7?'七':worlds}世界 · 球状知识图谱`;}}
  for(const element of content){for(const text of element.querySelectorAll('text'))text.remove();}const decorations=content.filter(node=>node.tagName!=='text');return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1560 1120" preserveAspectRatio="none" aria-hidden="true">${document.querySelector('defs')!.outerHTML}${decorations.map(node=>node.outerHTML).join('')}</svg>`;
}
