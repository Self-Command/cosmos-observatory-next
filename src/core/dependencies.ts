import type { FileDescriptor,InspectionResult,RelationDescriptor } from './types';
/** Resolve only explicit relative module specifiers; never execute or guess package internals. */
export function dependencyRelations(files:FileDescriptor[],results:Record<string,InspectionResult>,normalize:(path:string)=>string){
  const byPath=new Map(files.map(file=>[file.path,file])),relations:RelationDescriptor[]=[];
  for(const file of files){const result=results[file.id];if(!result||result.version!==file.version)continue;for(const specifier of result.dependencies){if(!specifier.startsWith('.'))continue;const candidate=normalize(file.path.split('/').slice(0,-1).join('/')+'/'+specifier);const paths=[candidate,...['.ts','.js','.tsx','.jsx','.mjs','.cjs','/index.ts','/index.js'].map(suffix=>candidate+suffix)];const target=paths.map(path=>byPath.get(path)).find(Boolean);if(target)relations.push({id:`${file.id}|${target.id}|dependency`,source:file.id,target:target.id,kind:'dependency',evidence:`Babel import/export source: ${specifier}`});}}
  return relations;
}
