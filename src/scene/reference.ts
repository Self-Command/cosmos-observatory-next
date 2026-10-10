import source from '../../docs/assets/dashboard-spheres-v2.svg';

export interface ShapeReference {name:string;color:string;x:number;y:number;radius:number;subtitle:string;points:{x:number;y:number;size:number;opacity:number}[];branches:[number,number,number,number][];orbits:{rx:number;ry:number;angle:number;opacity:number}[]}
let cache:Map<string,ShapeReference>|undefined;
let vectorDocument:Document|undefined;
const panels=new Map<string,string>();let background:string|undefined;
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
export function panelVector(index:number,title:string){
  const key=`${index}:${title}`;if(panels.has(key))return panels.get(key)!;
  const document=referenceDocument(),group=[...document.querySelectorAll('g[transform]')].filter(node=>/^translate\(\d+ 940\)$/.test(node.getAttribute('transform')!))[index];
  if(!group)return '';
  const shell=group.cloneNode(true) as Element;shell.removeAttribute('transform');while(shell.children.length>4)shell.lastElementChild!.remove();shell.children[1].textContent=title;
  const svg=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 244 142" preserveAspectRatio="none" aria-hidden="true">${document.querySelector('defs')!.outerHTML}${shell.outerHTML}</svg>`;
  const value=svg.replace(/id="([^"]+)"/g,`id="panel-${index}-$1"`).replace(/url\(#([^)]*)\)/g,`url(#panel-${index}-$1)`);panels.set(key,value);return value;
}
export function spaceVector(){if(background)return background;const document=referenceDocument();return background=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1560 1120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${document.querySelector('defs')!.outerHTML}<rect width="1560" height="1120" fill="url(#space)"/>${document.querySelector('#decorative-background')!.outerHTML}</svg>`;}
export function chromeVector(worlds:number,model:string){const document=referenceDocument(),nodes=[...document.documentElement.children],start=nodes.findIndex(node=>node.tagName==='rect'&&node.getAttribute('height')==='57'),end=nodes.findIndex(node=>node.id==='cross-world-links');const content=nodes.slice(start,end).map(node=>node.cloneNode(true) as Element);for(const element of content){const texts=element.tagName==='text'?[element]:[...element.querySelectorAll('text')];for(const text of texts){const value=text.textContent??'';if(value.includes('视觉稿'))text.textContent='○ LOCAL / READ ONLY';if(value==='7 WORLDS')text.textContent=`${worlds} WORLDS`;if(value==='MODEL v3')text.textContent=`MODEL ${model||'—'}`;if(value==='VISUAL DRAFT 02')text.textContent='LOCAL OBSERVATION';if(value==='七世界 · 球状知识图谱')text.textContent=`${worlds===7?'七':worlds}世界 · 球状知识图谱`;}}
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1560 1120" preserveAspectRatio="none" aria-hidden="true">${document.querySelector('defs')!.outerHTML}${content.map(node=>node.outerHTML).join('')}</svg>`;
}
