import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({call:vi.fn(),start:vi.fn(),isConnected:vi.fn(),onDisconnected:vi.fn(),dispose:vi.fn(),open:vi.fn(),close:vi.fn(),action:vi.fn(),addListener:vi.fn(),removeListener:vi.fn(),ready:vi.fn()}));
vi.mock('../src/content/startup',()=>({waitForXReady:mocks.ready}));
vi.mock('../src/content/engine.js',()=>({start:mocks.start}));
vi.mock('../src/shared/client',()=>({call:mocks.call}));
vi.mock('../src/shared/connection',()=>({isConnected:mocks.isConnected,onDisconnected:mocks.onDisconnected,isDisconnectedError:(e:any)=>e?.kind==='disconnected'}));
vi.mock('../src/content/settings-dialog',()=>({createSettingsDialog:()=>({dispose:mocks.dispose,open:mocks.open,close:mocks.close,action:mocks.action})}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();mocks.isConnected.mockReturnValue(true);mocks.ready.mockResolvedValue(true);mocks.call.mockResolvedValue(null);vi.stubGlobal('chrome',{runtime:{id:'test',getURL:(p:string)=>'chrome-extension://test/'+p,onMessage:{addListener:mocks.addListener,removeListener:mocks.removeListener}}});});
afterEach(()=>vi.unstubAllGlobals());
it('PAGE_READYのストレージエラーがあってもフィルターを起動する',async()=>{
 mocks.call.mockRejectedValue(Error('storage.session.remove failed'));await import('../src/content/index');
 expect(mocks.call).toHaveBeenCalledWith('PAGE_READY');expect(mocks.start).toHaveBeenCalledTimes(1);
});
it('正常なPAGE_READYの後もフィルターを起動する',async()=>{await import('../src/content/index');expect(mocks.start).toHaveBeenCalledTimes(1);});
it.each(['disconnected','runtime-gone'])('拡張が切断された%sでは起動しない',async mode=>{
 if(mode==='disconnected')mocks.call.mockRejectedValue({kind:'disconnected'});
 else{mocks.call.mockRejectedValue(Error('runtime gone'));mocks.isConnected.mockReturnValue(false);}
 await import('../src/content/index');expect(mocks.start).not.toHaveBeenCalled();
});

it('Xが入口から遷移し画面を準備するまではフィルターを作らない',async()=>{
 let finish!:(value:boolean)=>void;mocks.ready.mockImplementation(()=>new Promise(resolve=>{finish=resolve;}));
 await import('../src/content/index');expect(mocks.start).not.toHaveBeenCalled();expect(finish).toBeTruthy();
 finish(true);await Promise.resolve();expect(mocks.start).toHaveBeenCalledTimes(1);
});
it('画面準備待ちの途中に接続が切れた場合は起動しない',async()=>{
 mocks.ready.mockResolvedValue(false);await import('../src/content/index');expect(mocks.start).not.toHaveBeenCalled();
});

it('画面準備待ち中でも設定の開閉・確認・コピーに応答し、完了後も受信処理を重複登録しない',async()=>{
 let ready!:(value:boolean)=>void;mocks.ready.mockImplementation(()=>new Promise(resolve=>{ready=resolve;}));mocks.open.mockReturnValue({opened:true});mocks.close.mockReturnValue({closed:true});mocks.action.mockResolvedValue({ok:true,value:true});
 await import('../src/content/index');const handler=mocks.addListener.mock.calls[0][0],sender={id:'test'},respond=vi.fn();expect(mocks.start).not.toHaveBeenCalled();
 handler({type:'OPEN_SETTINGS',url:'editor-url'},sender,respond);expect(mocks.open).toHaveBeenCalledWith('editor-url');expect(respond).toHaveBeenLastCalledWith({opened:true});
 handler({type:'CLOSE_SETTINGS',token:'token'},sender,respond);expect(mocks.close).toHaveBeenCalledWith('token');
 for(const type of ['CONFIRM_SETTINGS','COPY_SETTINGS'])expect(handler({type,token:'token',value:'value'},sender,respond)).toBe(true);
 await Promise.resolve();expect(mocks.action).toHaveBeenCalledWith('COPY_SETTINGS','token','value');expect(respond).toHaveBeenLastCalledWith({ok:true,value:true});
 ready(true);await Promise.resolve();expect(mocks.start).toHaveBeenCalledTimes(1);expect(mocks.addListener).toHaveBeenCalledTimes(1);
 const listen=mocks.start.mock.calls[0][0].listen,filter=vi.fn(()=>({summary:{target:3}})),stop=listen(filter);
 handler({type:'SNAPSHOT'},sender,respond);expect(filter).toHaveBeenCalledWith({type:'SNAPSHOT'});expect(respond).toHaveBeenLastCalledWith({summary:{target:3}});stop();
});
it.each(['ja','en'])('待機中の%sの状態を返し、接続切れでは受信処理も解除する',async lang=>{
 document.documentElement.lang=lang;mocks.ready.mockReturnValue(new Promise(()=>{}));await import('../src/content/index');const handler=mocks.addListener.mock.calls[0][0],respond=vi.fn();
 handler({type:'SNAPSHOT'}, {id:'test'},respond);expect(respond).toHaveBeenLastCalledWith(expect.objectContaining({initializing:true,paused:false,rows:[],message:expect.stringContaining(lang==='ja'?'Xの画面を準備中':'Waiting for X')}));
 handler({type:'PAUSE'},{id:'test'},respond);expect(respond.mock.calls.at(-1)![0].paused).toBe(false);
 mocks.onDisconnected.mock.calls[0][0]();expect(mocks.dispose).toHaveBeenCalled();expect(mocks.removeListener).toHaveBeenCalledWith(handler);
});
it('古い許可の失効が完了する前には設定の受信を始めない',async()=>{
 let finish!:()=>void;mocks.call.mockReturnValue(new Promise<void>(resolve=>{finish=resolve;}));mocks.ready.mockReturnValue(new Promise(()=>{}));
 await import('../src/content/index');expect(mocks.addListener).not.toHaveBeenCalled();finish();await Promise.resolve();expect(mocks.addListener).toHaveBeenCalledTimes(1);
});
it('待機中も拡張以外の送信元から設定画面を開かせない',async()=>{
 mocks.ready.mockReturnValue(new Promise(()=>{}));await import('../src/content/index');const handler=mocks.addListener.mock.calls[0][0],respond=vi.fn();
 handler({type:'OPEN_SETTINGS',url:'untrusted'},{id:'other-extension'},respond);expect(mocks.open).not.toHaveBeenCalled();expect(respond).not.toHaveBeenCalled();
});
