import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
let local:Record<string,any>,session:Record<string,any>,remote:Record<string,any>,message:any,alarm:any,action:any,removed:any,updated:any;
function area(data:Record<string,any>){return {get:vi.fn(async(keys:any)=>keys==null?structuredClone(data):structuredClone(Object.fromEntries((typeof keys==='string'?[keys]:keys).filter((k:string)=>k in data).map((k:string)=>[k,data[k]])))),set:vi.fn(async(value:any)=>{Object.assign(data,structuredClone(value));}),remove:vi.fn(async(keys:string|string[])=>{for(const key of typeof keys==='string'?[keys]:keys)delete data[key];}),setAccessLevel:vi.fn(async()=>{})};}
async function send(payload:any,sender:any={id:'test-extension',url:'chrome-extension://test-extension/src/dashboard/index.html'}){return new Promise<any>((resolve,reject)=>message(payload,sender,(reply:any)=>reply.ok?resolve(reply.value):reject(Error(reply.error))));}
beforeEach(async()=>{
 vi.resetModules();local={};session={};remote={};const scheduled=new Map();
 vi.stubGlobal('crypto',webcrypto);
 vi.stubGlobal('chrome',{
  runtime:{id:'test-extension',getURL:(path:string)=>'chrome-extension://test-extension/'+path,openOptionsPage:vi.fn(async()=>{}),onMessage:{addListener:(fn:any)=>{message=fn;}}},
  storage:{local:area(local),session:area(session),sync:area(remote),onChanged:{addListener:vi.fn()}},
  action:{onClicked:{addListener:(fn:any)=>{action=fn;}}},permissions:{contains:async()=>false},
  tabs:{query:async()=>[{id:1,url:'https://x.com/home'}],get:async(id:number)=>({id,url:'https://x.com/home'}),sendMessage:vi.fn(async(_id:number,m:any)=>m.type==='OPEN_SETTINGS'?{opened:true}:m.type==='CLOSE_SETTINGS'?{closed:true}:m.type==='CONFIRM_SETTINGS'||m.type==='COPY_SETTINGS'?{ok:true,value:true}:{url:'https://x.com/home',summary:{target:1},rows:m.details?[{postId:'123',text:'ポスト本文'}]:[]}),create:vi.fn(async()=>{}),update:vi.fn(),remove:vi.fn(),onRemoved:{addListener:(fn:any)=>{removed=fn;}},onUpdated:{addListener:(fn:any)=>{updated=fn;}}},
  alarms:{get:async(name:string)=>scheduled.get(name),create:vi.fn(async(name:string,value:any)=>{scheduled.set(name,value);}),clear:async(name:string)=>scheduled.delete(name),onAlarm:{addListener:(fn:any)=>{alarm=fn;}}}
 });
 await import('../src/background/index');await vi.waitFor(()=>expect(local.xpf_sync_state).toBeTruthy());
});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();});
const pageSender={id:'test-extension',url:'https://x.com/home',frameId:0,tab:{id:1,url:'https://x.com/home'}};
const frameSender={id:'test-extension',url:'chrome-extension://test-extension/src/dashboard/index.html?embedded=1',frameId:7,tab:{id:1,url:'https://x.com/home'}};
it('チップとツールバーからX上のダイアログを開き、新しいタブを作らない',async()=>{
 await send({type:'OPEN'},pageSender);const token=session['xpf_editor:1'].token;
 expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(1,expect.objectContaining({type:'OPEN_SETTINGS',url:expect.stringContaining('#token='+token)}),{frameId:0});
 action({id:1,url:'https://x.com/home'});await vi.waitFor(()=>expect(vi.mocked(chrome.tabs.sendMessage).mock.calls.filter(c=>(c[1] as {type?:string}).type==='OPEN_SETTINGS')).toHaveLength(2));
 expect(session['xpf_editor:1'].token).toBe(token);expect(chrome.tabs.create).not.toHaveBeenCalled();expect(chrome.runtime.openOptionsPage).not.toHaveBeenCalled();
});
it('許可した設定フレームだけにキーを返し、通常のページや無断の埋め込みには返さない',async()=>{
 local.xpf_local_v1={provider:'jev',profiles:{jev:{key:'secret-test-key'}}};await send({type:'OPEN'},pageSender);const token=session['xpf_editor:1'].token;
 await expect(send({type:'GET'},frameSender)).rejects.toThrow();await expect(send({type:'GET',editorToken:'wrong'},frameSender)).rejects.toThrow();
 expect(JSON.stringify(await send({type:'GET'},pageSender))).not.toContain('secret-test-key');
 expect(JSON.stringify(await send({type:'GET',editorToken:token},frameSender))).toContain('secret-test-key');
 await expect(send({type:'GET',editorToken:token},{...frameSender,tab:{id:2,url:'https://x.com/home'}})).rejects.toThrow();
});
it('閉じる操作は元のXタブを閉じず、ダイアログだけを閉じて許可を失効する',async()=>{
 await send({type:'OPEN'},pageSender);const token=session['xpf_editor:1'].token;
 await send({type:'CLOSE',editorToken:token},frameSender);
 expect(chrome.tabs.remove).not.toHaveBeenCalled();expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(1,{type:'CLOSE_SETTINGS',token},{frameId:0});
 expect(session['xpf_editor:1']).toBeUndefined();await expect(send({type:'GET',editorToken:token},frameSender)).rejects.toThrow();
});
it('設定フレームのページ操作・確認・コピーは元のXタブへ結び付ける',async()=>{
 await send({type:'OPEN'},pageSender);const token=session['xpf_editor:1'].token;
 await send({type:'PAGE',tabId:999,editorToken:token},frameSender);expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(1,{type:'SNAPSHOT',details:false});
 expect(await send({type:'CONFIRM',value:'消去しますか？',editorToken:token},frameSender)).toBe(true);
 expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(1,{type:'CONFIRM_SETTINGS',token,value:'消去しますか？'},{frameId:0});
 await send({type:'COPY',value:'投稿者\t本文',editorToken:token},frameSender);expect(chrome.tabs.sendMessage).toHaveBeenLastCalledWith(1,{type:'COPY_SETTINGS',token,value:'投稿者\t本文'},{frameId:0});
});
it('フレームの許可完了通知だけを信用せず、Chromeの実際の権限を確認する',async()=>{
 await send({type:'OPEN'},pageSender);const token=session['xpf_editor:1'].token;
 expect(await send({type:'PERMISSION_GRANTED',provider:'jev',granted:true,editorToken:token},frameSender)).toBe(false);
 Object.assign(chrome.permissions,{contains:async()=>true});
 expect(await send({type:'PERMISSION_GRANTED',provider:'jev',editorToken:token},frameSender)).toBe(true);
});
it('フレーム読み込みとX内の画面移動では許可を保ち、Xを離れるかタブ終了で失効する',async()=>{
 await send({type:'OPEN'},pageSender);updated(1,{status:'loading'});expect(session['xpf_editor:1']).toBeTruthy();
 updated(1,{url:'https://x.com/search?q=test'});expect(session['xpf_editor:1']).toBeTruthy();
 updated(1,{url:'https://example.com/'});await vi.waitFor(()=>expect(session['xpf_editor:1']).toBeUndefined());
 await send({type:'OPEN'},pageSender);removed(1);await vi.waitFor(()=>expect(session['xpf_editor:1']).toBeUndefined());
});
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

it.each(['missing','rejected'])('設定フレームを開けない%sタブでは、元のXタブを保持して設定タブを開く',async mode=>{
 vi.mocked(chrome.tabs.sendMessage).mockImplementationOnce(async()=>{if(mode==='missing')throw Error('Receiving end does not exist');return {opened:false} as any;});
 await send({type:'OPEN'},pageSender);expect(chrome.tabs.create).toHaveBeenCalledWith({url:'chrome-extension://test-extension/src/dashboard/index.html?tab=1&reload=1'});expect(chrome.tabs.remove).not.toHaveBeenCalled();expect(session['xpf_editor:1']).toBeUndefined();
});
it('代替の設定タブがある場合は再利用し、何度押しても増やさない',async()=>{
 const url='chrome-extension://test-extension/src/dashboard/index.html?tab=1&reload=1';vi.spyOn(chrome.tabs,'query').mockResolvedValue([{id:22,url} as chrome.tabs.Tab]);vi.mocked(chrome.tabs.sendMessage).mockRejectedValue(Error('Receiving end does not exist'));
 await send({type:'OPEN'},pageSender);await send({type:'OPEN'},pageSender);expect(chrome.tabs.update).toHaveBeenCalledTimes(2);expect(chrome.tabs.update).toHaveBeenCalledWith(22,{active:true});expect(chrome.tabs.create).not.toHaveBeenCalled();
});
