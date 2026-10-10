import { parse } from '@babel/parser';
import { parseDocument } from 'yaml';
import type { FileDescriptor, Issue } from './types';
export const supportsSyntax=(extension:string)=>['js','cjs','mjs','ts','tsx','jsx','json','yaml','yml','md'].includes(extension);
export function inspectSyntax(file:FileDescriptor,text:string){
  const issues:Issue[]=[],rules:string[]=[],unassessed:string[]=[],dependencies:string[]=[];
  const check=(rule:string,fn:()=>void)=>{rules.push(rule);try{fn();}catch(error){const e=error as {message?:string;loc?:{line:number}};issues.push({rule,message:e.message??String(error),line:e.loc?.line});}};
  const js=(body:string)=>{const ast=parse(body,{sourceType:'unambiguous',allowAwaitOutsideFunction:true,plugins:[...(file.extension.includes('ts')?['typescript' as const]:[]),...(file.extension.endsWith('x')?['jsx' as const]:[])]});for(const node of ast.program.body)if((node.type==='ImportDeclaration'||node.type==='ExportAllDeclaration'||node.type==='ExportNamedDeclaration')&&node.source)dependencies.push(node.source.value);const walk=(value:unknown)=>{if(!value||typeof value!=='object')return;const node=value as any;if(node.type==='CallExpression'&&node.callee?.type==='Identifier'&&node.callee.name==='require'&&node.arguments?.[0]?.type==='StringLiteral')dependencies.push(node.arguments[0].value);if(node.type==='ImportExpression'&&node.source?.type==='StringLiteral')dependencies.push(node.source.value);for(const child of Object.values(node)){if(Array.isArray(child))child.forEach(walk);else if(child&&typeof child==='object')walk(child);}};walk(ast.program);};
  if(['js','cjs','mjs','ts','tsx','jsx'].includes(file.extension))check('javascript.syntax',()=>js(text));
  else if(file.extension==='json')check('json.syntax',()=>{JSON.parse(text);});
  else if(['yaml','yml'].includes(file.extension))check('yaml.syntax',()=>{const doc=parseDocument(text);if(doc.errors.length)throw doc.errors[0];});
  else if(file.extension==='md'){
    const header=/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/.exec(text);
    if(text.startsWith('---\n')||text.startsWith('---\r\n'))check('frontmatter.syntax',()=>{if(!header)throw Error('Frontmatter 缺少结束标记');const doc=parseDocument(header[1]);if(doc.errors.length)throw doc.errors[0];});
    if(file.asset==='template'){
      const blocks=[...text.matchAll(/<%([\s\S]*?)%>/g)];for(const block of blocks)check('templater.syntax',()=>{const content=block[1].trim().replace(/^[*=-]/,'');js(`async function template(){${content}}`);});
      if((text.match(/<%/g)?.length??0)!==blocks.length)issues.push({rule:'templater.syntax',message:'Templater 代码块缺少结束标记'});
    }
    rules.push('obsidian.links');
  } else unassessed.push('该文件类型未提供静态解析器');
  return {issues,rules,unassessed,dependencies};
}
