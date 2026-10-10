import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import Ajv from 'ajv';
import { timingSafeEqual } from 'node:crypto';
import type { ObservatoryEvent } from '../core/types';
export const eventSchema={type:'object',additionalProperties:false,required:['id','at','source','action','sessionId','runId','status','sequence'],properties:{id:{type:'string',minLength:1,maxLength:128},at:{type:'integer',minimum:0},source:{enum:['claude-hook','codex-public-api','bridge']},action:{enum:['session.start','session.end','search','read.partial','read.full','modify','tool.start','tool.end']},sessionId:{type:'string',minLength:1,maxLength:128},runId:{type:'string',minLength:1,maxLength:128},toolId:{type:'string',minLength:1,maxLength:128},toolName:{type:'string',maxLength:128},readRange:{type:'object',additionalProperties:false,properties:{offset:{type:'integer',minimum:0},limit:{type:'integer',minimum:0}}},sequence:{type:'integer',minimum:0},status:{enum:['success','failed','unknown','cancelled']},path:{type:'string',maxLength:1024}}};
const validate=new Ajv({allErrors:true}).compile(eventSchema);
export class EventReceiver {
  private server=Fastify({logger:false,bodyLimit:8192});private seen=new Set<string>();private sequence=new Map<string,number>();
  constructor(private token:string,private publish:(event:ObservatoryEvent)=>void,private capacity=5000,private rate=120,previous:ObservatoryEvent[]=[]){for(const event of previous.slice(-capacity)){if(event.kind!=='agent')continue;this.seen.add(JSON.stringify([event.source,event.sessionId,event.id]));if(event.sequence!==undefined){const key=JSON.stringify([event.source,event.sessionId,event.runId]);this.sequence.set(key,Math.max(this.sequence.get(key)??-1,event.sequence));}}}
  async start(port:number){
    await this.server.register(rateLimit,{max:this.rate,timeWindow:60000});
    this.server.post('/v1/events',async(request,reply)=>{
      const actual=Buffer.from(String(request.headers.authorization??'')),expected=Buffer.from(`Bearer ${this.token}`);
      if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return reply.code(401).send({error:'unauthorized'});
      if(!validate(request.body))return reply.code(400).send({error:'invalid contract'});
      const body=request.body as Omit<ObservatoryEvent,'kind'|'evidence'>;
      if(body.path&&(body.path.startsWith('/')||body.path.includes('\\')||body.path.includes(':')||body.path.split('/').some(p=>p==='..'||p==='.')||body.path.startsWith('.obsidian/')))return reply.code(400).send({error:'invalid vault target'});
      const identity=JSON.stringify([body.source,body.sessionId,body.id]);if(this.seen.has(identity))return reply.code(200).send({duplicate:true});
      if(this.seen.size>=this.capacity)this.seen.delete(this.seen.values().next().value!);this.seen.add(identity);
      const key=JSON.stringify([body.source,body.sessionId,body.runId]),previous=this.sequence.get(key);this.sequence.set(key,Math.max(previous??-1,body.sequence!));
      if(this.sequence.size>this.capacity)this.sequence.delete(this.sequence.keys().next().value!);
      const late=previous!==undefined&&body.sequence!<=previous,gap=previous!==undefined&&body.sequence!>previous+1;
      if(late||gap)this.publish({id:crypto.randomUUID(),at:Date.now(),kind:'system',source:body.source,action:late?'sequence.late':'sequence.gap',status:'unknown',sessionId:body.sessionId,runId:body.runId,evidence:`上次 ${previous}，本次 ${body.sequence}；${late?'迟到事件，保留原始证据':'检测到序号缺口，缺失过程未知'}`});
      this.publish({...body,kind:'agent',delivery:late?'late':gap?'gap':'ordered',evidence:'经鉴权的来源声明；未验证内容理解'});return {accepted:true};
    });
    await this.server.listen({host:'127.0.0.1',port});
  }
  async close(){await this.server.close();}
}
