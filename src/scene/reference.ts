import source from '../../docs/assets/dashboard-spheres-v2.svg';

export interface ShapeReference {name:string;color:string;x:number;y:number;radius:number;subtitle:string;points:{x:number;y:number;size:number;opacity:number}[];branches:[number,number,number,number][]}
let cache:Map<string,ShapeReference>|undefined;
let vectorDocument:Document|undefined;
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
    cache.set(name,{name,color:title.getAttribute('fill')!,x:Number(xy[1]),y:Number(xy[2]),radius:Number(outline.getAttribute('r')),subtitle:group.querySelector('text.micro[letter-spacing]')?.textContent??'',points,branches});
  }
  return cache;
}
export function spaceStops(){return [['0','#0b141f'],['0.55','#060b12'],['1','#030609']] as const;}
export function panelVector(index:number,title:string){
  const document=referenceDocument(),group=[...document.querySelectorAll('g[transform]')].filter(node=>/^translate\(\d+ 940\)$/.test(node.getAttribute('transform')!))[index];
  if(!group)return '';
  const shell=group.cloneNode(true) as Element;shell.removeAttribute('transform');while(shell.children.length>4)shell.lastElementChild!.remove();shell.children[1].textContent=title;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 244 142" preserveAspectRatio="none" aria-hidden="true">${document.querySelector('defs')!.outerHTML}${shell.outerHTML}</svg>`;
}
export function spaceVector(){const document=referenceDocument();return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1560 1120" preserveAspectRatio="xMidYMid slice" aria-hidden="true">${document.querySelector('defs')!.outerHTML}<rect width="1560" height="1120" fill="url(#space)"/>${document.querySelector('#decorative-background')!.outerHTML}</svg>`;}
