import type {FileDescriptor,RelationDescriptor,Snapshot} from '../core/types';
/** Fair round-robin uses unused capacity from sparse worlds, with stable priority targets. */
export function allocateFiles(snapshot:Snapshot,budget:number,priority:string[]=[]){
  const groups=new Map(snapshot.worlds.map(world=>[world.id,[] as FileDescriptor[]]));for(const file of snapshot.files)if(file.worldId)groups.get(file.worldId)?.push(file);
  const byId=new Map(snapshot.files.map(file=>[file.id,file])),selected=new Map<string,FileDescriptor>();
  for(const id of [...priority,...snapshot.worlds.map(world=>world.centerId).filter((id):id is string=>!!id)]){const file=byId.get(id);if(file?.worldId&&groups.has(file.worldId)&&selected.size<budget)selected.set(id,file);}
  const queues=[...groups.values()].map(files=>files.filter(file=>!selected.has(file.id))),cursors=new Array(queues.length).fill(0);let changed=true;
  while(selected.size<budget&&changed){changed=false;for(const [index,queue] of queues.entries()){const file=queue[cursors[index]++];if(file){selected.set(file.id,file);changed=true;if(selected.size>=budget)break;}}}
  return {files:[...selected.values()],hidden:new Map([...groups].map(([id,files])=>[id,files.filter(file=>!selected.has(file.id)).length]))};
}
export function physicalLinks(relations:RelationDescriptor[],visible:Set<string>,budget:number,predicate:(relation:RelationDescriptor)=>boolean=()=>true){const seen=new Set<string>(),links:RelationDescriptor[]=[];for(const relation of relations){if(!visible.has(relation.source)||!visible.has(relation.target)||relation.source===relation.target||!predicate(relation))continue;const key=[relation.source,relation.target].sort().join('|');if(seen.has(key))continue;seen.add(key);links.push(relation);if(links.length>=budget)break;}return budget>0?links:[];}
