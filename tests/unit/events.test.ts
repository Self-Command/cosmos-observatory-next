import { describe,it,expect } from 'vitest';
import { EventReceiver } from '../../src/events/receiver';
import type { ObservatoryEvent } from '../../src/core/types';
describe('Local source evidence contract',()=>{
  it('restores duplicate and sequence evidence after restart without mixing sessions',async()=>{
    const old:ObservatoryEvent={id:'retained',at:1,kind:'agent',source:'bridge',sessionId:'one',runId:'r',action:'tool.end',status:'success',sequence:8,evidence:'retained'};
    const events:ObservatoryEvent[]=[],receiver=new EventReceiver('test-token',event=>events.push(event),5000,120,[old]);await receiver.start(0);const server=(receiver as any).server;
    const send=(payload:object)=>server.inject({method:'POST',url:'/v1/events',headers:{authorization:'Bearer test-token'},payload});const {kind,evidence,...body}=old;
    try{expect(JSON.parse((await send(body)).body)).toEqual({duplicate:true});expect(events).toHaveLength(0);await send({...body,id:'late',sequence:4});expect(events.some(event=>event.action==='sequence.late')).toBe(true);await send({...body,id:'gap',sequence:10});expect(events.some(event=>event.action==='sequence.gap')).toBe(true);await send({...body,sessionId:'two',sequence:0});expect(events.filter(event=>event.kind==='agent')).toHaveLength(3);expect(events.at(-1)?.delivery).toBe('ordered');}finally{await receiver.close();}
  });
  it('enforces authorization, targets, duplicates and sequence evidence',async()=>{const events:ObservatoryEvent[]=[];const receiver=new EventReceiver('test-token',event=>events.push(event));await receiver.start(0);const server=(receiver as any).server;const body={id:'1',at:Date.now(),source:'bridge',action:'read.partial',sessionId:'session',runId:'run',status:'success',sequence:1,path:'地球/a.md'};
    expect((await server.inject({method:'POST',url:'/v1/events',payload:body})).statusCode).toBe(401);
    const send=(payload:object)=>server.inject({method:'POST',url:'/v1/events',headers:{authorization:'Bearer test-token'},payload});
    expect((await send({...body,path:'../private'})).statusCode).toBe(400);expect((await send({...body,content:'private note'})).statusCode).toBe(400);expect((await send(body)).statusCode).toBe(200);await send(body);expect(events).toHaveLength(1);await send({...body,id:'2',sequence:4});expect(events.find(event=>event.action==='sequence.gap')).toBeTruthy();expect(events[0].action).toBe('read.partial');expect(events[0].evidence).toContain('未验证');await receiver.close();
  });
});
