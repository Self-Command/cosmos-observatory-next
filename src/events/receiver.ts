import Fastify from 'fastify';
import rateLimit from '@fastify/rate-limit';
import Ajv from 'ajv';
import { timingSafeEqual } from 'node:crypto';
import type { ObservatoryEvent } from '../core/types';
export const eventSchema={type:'object',additionalProperties:false,required:['id','at','source','action','sessionId','runId','status','sequence'],properties:{id:{type:'string',minLength:1,maxLength:128},at:{type:'integer',minimum:0},source:{enum:['claude-hook','codex-public-api','bridge']},action:{enum:['session.start','session.end','search','read.partial','read.full','modify','tool.start','tool.end']},sessionId:{type:'string',minLength:1,maxLength:128},runId:{type:'string',minLength:1,maxLength:128},sequence:{type:'integer',minimum:0},status:{enum:['success','failed','unknown','cancelled']},path:{type:'string',maxLength:1024}}};
const validate=new Ajv({allErrors:true}).compile(eventSchema);
export class EventReceiver {
  private server=Fastify({logger:false,bodyLimit:8192});private seen=new Set<string>();private sequence=new Map<string,number>();
  constructor(private token:string,private publish:(event:ObservatoryEvent)=>void,private capacity=5000,private rate=120){}
  async start(port:number){
    await this.server.register(rateLimit,{max:this.rate,timeWindow:60000});
    this.server.post('/v1/events',async(request,reply)=>{
      const actual=Buffer.from(String(request.headers.authorization??'')),expected=Buffer.from(`Bearer ${this.token}`);
      if(actual.length!==expected.length||!timingSafeEqual(actual,expected))return reply.code(401).send({error:'unauthorized'});
      if(!validate(request.body))return reply.code(400).send({error:'invalid contract'});
      const body=request.body as Omit<ObservatoryEvent,'kind'|'evidence'>;
      if(body.path&&(body.path.startsWith('/')||body.path.includes('\\')||body.path.includes(':')||body.path.split('/').some(p=>p==='..'||p==='.')||body.path.startsWith('.obsidian/')))return reply.code(400).send({error:'invalid vault target'});
      const identity=`${body.source}:${body.sessionId}:${body.id}`;if(this.seen.has(identity))return reply.code(200).send({duplicate:true});
      if(this.seen.size>=this.capacity)this.seen.delete(this.seen.values().next().value!);this.seen.add(identity);
      const key=`${body.source}:${body.sessionId}:${body.runId}`,previous=this.sequence.get(key);this.sequence.set(key,Math.max(previous??-1,body.sequence!));
      if(this.sequence.size>this.capacity)this.sequence.delete(this.sequence.keys().next().value!);
      if(previous!==undefined&&body.sequence!==previous+1)this.publish({id:crypto.randomUUID(),at:Date.now(),kind:'system',source:body.source,action:'sequence.gap',status:'unknown',sessionId:body.sessionId,runId:body.runId,evidence:`上次 ${previous}，本次 ${body.sequence}；可能乱序或缺失`});
      this.publish({...body,kind:'agent',evidence:'经鉴权的来源声明；未验证内容理解'});return {accepted:true};
    });
    await this.server.listen({host:'127.0.0.1',port});
  }
  async close(){await this.server.close();}
}
