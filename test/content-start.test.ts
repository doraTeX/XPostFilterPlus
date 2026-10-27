import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({call:vi.fn(),start:vi.fn(),isConnected:vi.fn(),onDisconnected:vi.fn(),dispose:vi.fn(),ready:vi.fn()}));
vi.mock('../src/content/startup',()=>({waitForXReady:mocks.ready}));
vi.mock('../src/content/engine.js',()=>({start:mocks.start}));
vi.mock('../src/shared/client',()=>({call:mocks.call}));
vi.mock('../src/shared/connection',()=>({isConnected:mocks.isConnected,onDisconnected:mocks.onDisconnected,isDisconnectedError:(e:any)=>e?.kind==='disconnected'}));
vi.mock('../src/content/settings-dialog',()=>({createSettingsDialog:()=>({dispose:mocks.dispose})}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();mocks.isConnected.mockReturnValue(true);mocks.ready.mockResolvedValue(true);mocks.call.mockResolvedValue(null);vi.stubGlobal('chrome',{runtime:{getURL:(p:string)=>'chrome-extension://test/'+p}});});
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
