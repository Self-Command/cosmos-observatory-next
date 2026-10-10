import {createInterface} from 'node:readline';
import {readFile} from 'node:fs/promises';
import {adaptClaude,adaptCodex} from './adapters';
const [source,vault,tokenFile,portText]=process.argv.slice(2),port=Number(portText);
if(!['claude-hook','codex-public-api'].includes(source)||!vault||!tokenFile||!Number.isInteger(port)||port<1024||port>65535)throw Error('Usage: node bridge.cjs <claude-hook|codex-public-api> <vault> <token-file> <port>');
const token=(await readFile(tokenFile,'utf8')).trim(),sequences=new Map<string,number>();
async function forward(text:string){
  if(Buffer.byteLength(text)>2*1024*1024)return;
  let input:Record<string,any>;try{input=JSON.parse(text);}catch{return;}
  const key=`${input.params?.threadId}:${input.params?.turnId}`,next=sequences.get(key)??0;
  const events=source==='claude-hook'?adaptClaude(input,vault):adaptCodex(input,vault,next);
  if(events.length)sequences.set(key,next+events.length);if(sequences.size>5000)sequences.delete(sequences.keys().next().value!);
  for(const event of events){const response=await fetch(`http://127.0.0.1:${port}/v1/events`,{method:'POST',headers:{authorization:`Bearer ${token}`,'content-type':'application/json'},body:JSON.stringify(event),signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error(`Local observation receiver rejected event (${response.status})`);}
}
if(source==='claude-hook'){let text='';for await(const chunk of process.stdin){text+=chunk.toString();if(Buffer.byteLength(text)>2*1024*1024)throw Error('Hook input exceeds bridge limit');}await forward(text);}else for await(const line of createInterface({input:process.stdin,crlfDelay:Infinity}))await forward(line);
