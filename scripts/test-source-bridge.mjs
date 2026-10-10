import './guard.mjs';
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,writeFile,rm,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
const directory=await mkdtemp(path.join(tmpdir(),'cosmos-source-contract-'));
const received=[],server=createServer(async(request,response)=>{
  let body='';for await(const chunk of request)body+=chunk;
  if(request.headers.authorization!=='Bearer synthetic-contract-token'){response.writeHead(401);response.end();return;}
  received.push(JSON.parse(body));response.writeHead(200,{'content-type':'application/json'});response.end('{"accepted":true}');
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const port=server.address().port,tokenFile=path.join(directory,'token');
const run=(source,inputs)=>new Promise((resolve,reject)=>{
  const child=spawn(process.execPath,['dist/plugin/bridge.mjs',source,'/synthetic-vault',tokenFile,String(port)],{stdio:['pipe','pipe','pipe']});let error='';
  const timeout=setTimeout(()=>{child.kill();reject(Error('Source bridge contract timed out'));},15000);
  child.stderr.on('data',chunk=>error+=chunk);child.on('error',reject);child.on('close',code=>{clearTimeout(timeout);resolve({code,error});});
  child.stdin.end(inputs.map(input=>JSON.stringify(input)).join('\n'));
});
try{
  await writeFile(tokenFile,'synthetic-contract-token');
  const item={id:'tool-1',type:'fileChange',status:'completed',changes:[{path:'/synthetic-vault/地球/a.md',diff:'PRIVATE_DIFF'}]};
  assert.equal((await run('codex-public-api',[{method:'item/started',params:{threadId:'s1',turnId:'r1',item}},{method:'item/completed',params:{threadId:'s1',turnId:'r1',item}},{method:'item/completed',params:{threadId:'s2',turnId:'r2',item:{id:'mcp',type:'mcpToolCall',status:'completed',result:{isError:true,content:'PRIVATE_OUTPUT'}}}}])).code,0);
  assert.deepEqual(received.map(event=>[event.sessionId,event.action,event.status]),[['s1','tool.start','unknown'],['s1','modify','success'],['s2','tool.end','failed']]);
  assert.equal(received[1].path,'地球/a.md');assert.deepEqual(received.map(event=>event.sequence),[0,1,0]);
  const completedId=received[1].id;
  assert.equal((await run('codex-public-api',[{method:'item/completed',params:{threadId:'s1',turnId:'r1',item}}])).code,0);assert.equal(received.at(-1).id,completedId);
  assert.equal((await run('claude-hook',[{session_id:'claude',tool_use_id:'read-1',hook_event_name:'PostToolUse',tool_name:'Read',tool_input:{file_path:'/synthetic-vault/a.md',offset:20,limit:40,content:'PRIVATE_CONTENT'},tool_response:{content:'PRIVATE_OUTPUT'},transcript_path:'PRIVATE_TRANSCRIPT'}])).code,0);
  assert.equal(received.at(-1).action,'read.partial');assert.deepEqual(received.at(-1).readRange,{offset:20,limit:40});
  assert.equal((await run('claude-hook',[{session_id:'claude',tool_use_id:'read-2',hook_event_name:'PostToolUseFailure',tool_name:'Read',tool_input:{file_path:'/outside/a.md'},is_interrupt:true,error:'PRIVATE_ERROR'}])).code,0);
  assert.equal(received.at(-1).status,'cancelled');assert.equal(received.at(-1).path,undefined);assert.ok(!JSON.stringify(received).includes('PRIVATE_'));
  await writeFile(tokenFile,'invalid-synthetic-token');assert.notEqual((await run('claude-hook',[{session_id:'s',hook_event_name:'SessionEnd'}])).code,0);
  await mkdir('test-results/source',{recursive:true});await writeFile('test-results/source/bridge-contract.json',JSON.stringify({transport:'Compiled CLI → loopback HTTP',events:received,restartIdentityPreserved:true,authorizationFailureRejected:true},null,2));
  console.log('Compiled source CLI: two sessions, restart identity, outcomes, ranges, privacy and authorization passed.');
}finally{await new Promise(resolve=>server.close(resolve));await rm(directory,{recursive:true,force:true});}
