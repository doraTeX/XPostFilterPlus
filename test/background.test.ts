import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
let local:Record<string,any>,session:Record<string,any>,remote:Record<string,any>,message:any,alarm:any;
function area(data:Record<string,any>){return {get:vi.fn(async(keys:any)=>keys==null?structuredClone(data):structuredClone(Object.fromEntries((typeof keys==='string'?[keys]:keys).filter((k:string)=>k in data).map((k:string)=>[k,data[k]])))),set:vi.fn(async(value:any)=>{Object.assign(data,structuredClone(value));}),remove:vi.fn(async(keys:string|string[])=>{for(const key of typeof keys==='string'?[keys]:keys)delete data[key];}),setAccessLevel:vi.fn(async()=>{})};}
async function send(payload:any,sender:any={id:'test-extension',url:'chrome-extension://test-extension/src/dashboard/index.html'}){return new Promise<any>((resolve,reject)=>message(payload,sender,(reply:any)=>reply.ok?resolve(reply.value):reject(Error(reply.error))));}
beforeEach(async()=>{
 vi.resetModules();local={};session={};remote={};const scheduled=new Map();
 vi.stubGlobal('crypto',webcrypto);
 vi.stubGlobal('chrome',{
  runtime:{id:'test-extension',getURL:(path:string)=>'chrome-extension://test-extension/'+path,openOptionsPage:vi.fn(async()=>{}),onMessage:{addListener:(fn:any)=>{message=fn;}}},
  storage:{local:area(local),session:area(session),sync:area(remote),onChanged:{addListener:vi.fn()}},
  action:{onClicked:{addListener:vi.fn()}},permissions:{contains:async()=>false},
  tabs:{query:async()=>[{id:1,url:'https://x.com/home'}],get:async(id:number)=>({id,url:'https://x.com/home'}),sendMessage:vi.fn(async(_id:number,m:any)=>m.type==='OPEN_SETTINGS'?{opened:true}:m.type==='CLOSE_SETTINGS'?{closed:true}:m.type==='CONFIRM_SETTINGS'||m.type==='COPY_SETTINGS'?{ok:true,value:true}:{url:'https://x.com/home',summary:{target:1},rows:m.details?[{postId:'123',text:'ポスト本文'}]:[]}),create:vi.fn(async()=>{}),update:vi.fn(),remove:vi.fn(),onRemoved:{addListener:vi.fn()},onUpdated:{addListener:vi.fn()}},
  alarms:{get:async(name:string)=>scheduled.get(name),create:vi.fn(async(name:string,value:any)=>{scheduled.set(name,value);}),clear:async(name:string)=>scheduled.delete(name),onAlarm:{addListener:(fn:any)=>{alarm=fn;}}}
 });
 await import('../src/background/index');await vi.waitFor(()=>expect(local.xpf_sync_state).toBeTruthy());
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
it('定期取得は軽量で、明示操作でだけ詳細を要求する',async()=>{
 expect((await send({type:'PAGE',tabId:1})).rows).toEqual([]);
 expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(1,{type:'SNAPSHOT',details:false});
 expect((await send({type:'PAGE',tabId:1,details:true})).rows[0].postId).toBe('123');
});
it('判定表のデータを再読み込みでも保持し、直近5件より古いものを整理する',async()=>{
 await send({type:'REPORT',tabId:1});const first=Object.keys(session)[0].slice('xpf_report:'.length);
 const initial=await send({type:'REPORT_DATA',id:first});expect(initial.rows[0].text).toBe('ポスト本文');
 expect(await send({type:'REPORT_DATA',id:first})).toEqual(initial);
 for(let i=0;i<5;i++)await send({type:'REPORT',tabId:1});
 expect(Object.keys(session)).toHaveLength(5);await expect(send({type:'REPORT_DATA',id:first})).rejects.toThrow();
});
it('UUIDではなく作成時刻の古い表を整理し、同時に表を開いても上限を守る',async()=>{
 for(let i=0;i<5;i++)session['xpf_report:'+String(5-i)]={time:i};
 await Promise.all([send({type:'REPORT',tabId:1}),send({type:'REPORT',tabId:1})]);
 expect(Object.keys(session)).toHaveLength(5);expect(session['xpf_report:5']).toBeUndefined();expect(session['xpf_report:4']).toBeUndefined();expect(session['xpf_report:1']).toBeTruthy();
});
it('大きすぎる表では保存済みの表を壊さず、対処方法を表示する',async()=>{
 await send({type:'REPORT',tabId:1});const before=structuredClone(session);
 vi.mocked(chrome.tabs.sendMessage).mockResolvedValueOnce({rows:[{text:'字'.repeat(2200000)}]});
 await expect(send({type:'REPORT',tabId:1})).rejects.toThrow('TSVでコピー');
 expect(session).toEqual(before);
});
it('同期アラームから送信失敗を再試行する',async()=>{
 vi.spyOn(chrome.storage.sync,'set').mockRejectedValueOnce(Error('network'));
 expect((await send({type:'SYNC_ENABLED',enabled:true})).pending).toBe(true);
 expect(chrome.alarms.create).toHaveBeenCalledWith('xpf-sync',expect.objectContaining({periodInMinutes:5}));
 alarm({name:'xpf-sync'});await vi.waitFor(()=>expect(local.xpf_sync_state.pending).toBe(false));
 expect(Object.keys(remote).length).toBeGreaterThan(0);
});
