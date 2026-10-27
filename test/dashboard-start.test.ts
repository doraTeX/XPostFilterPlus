import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({mount:vi.fn(),call:vi.fn()}));
vi.mock('../src/dashboard/ui',()=>({mountDashboard:mocks.mount}));
vi.mock('../src/shared/client',()=>({call:mocks.call}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();Object.defineProperty(location,'ancestorOrigins',{configurable:true,value:['https://x.com']});document.body.innerHTML='<main id="app"></main>';mocks.mount.mockRejectedValue(Error('Invalid editor token'));});
afterEach(()=>{window.dispatchEvent(new Event('pagehide'));vi.unstubAllGlobals();Reflect.deleteProperty(location,'ancestorOrigins');document.body.replaceChildren();document.documentElement.classList.remove('embedded');});
it.each(['https://x.com','https://twitter.com'])('埋め込み設定のGET失敗後も実際の親%sだけへ退出を要求する',async origin=>{
 Object.defineProperty(location,'ancestorOrigins',{configurable:true,value:[origin]});
 const parentWindow={postMessage:vi.fn()};vi.stubGlobal('parent',parentWindow);await import('../src/dashboard/main');await Promise.resolve();
 expect(document.querySelector('[role=alert]')!.textContent).toBe('Invalid editor token');document.querySelector<HTMLButtonElement>('button')!.click();await Promise.resolve();
 expect(parentWindow.postMessage).toHaveBeenCalledExactlyOnceWith({type:'XPF_CLOSE_EMPTY'},origin);expect(mocks.call).not.toHaveBeenCalled();
});
it('トップレベルの設定画面でも初期化失敗後にEscで閉じられる',async()=>{
 vi.stubGlobal('parent',window);await import('../src/dashboard/main');await Promise.resolve();
 // トップレベルの設定エラーでは通常のCLOSEを使う。
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await Promise.resolve();expect(mocks.call).toHaveBeenCalledWith('CLOSE',{});
});
it('storageなしでも通知監視で初期化を中断せず、設定画面を閉じられる',async()=>{
 vi.useFakeTimers();vi.stubGlobal('chrome',{});vi.stubGlobal('parent',window);
 const close=vi.fn(async()=>{}),dispose=vi.fn();let stop!:()=>void;
 mocks.mount.mockImplementation(async(_root,api)=>{stop=api.onChange(vi.fn());return {close,focus:vi.fn(),dispose};});
 try{await import('../src/dashboard/main');await Promise.resolve();window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await Promise.resolve();
 expect(close).toHaveBeenCalledTimes(1);expect(document.querySelector('[role=alert]')).toBeNull();
 }finally{stop?.();vi.useRealTimers();}
});

it.each(['https://evil.example','https://x.com.evil.example',undefined])('許可していない親%sには閉じる通知を送らない',async origin=>{
 Object.defineProperty(location,'ancestorOrigins',{configurable:true,value:origin?[origin]:undefined});
 const parentWindow={postMessage:vi.fn()};vi.stubGlobal('parent',parentWindow);await import('../src/dashboard/main');await Promise.resolve();
 document.querySelector<HTMLButtonElement>('button')!.click();await Promise.resolve();expect(parentWindow.postMessage).not.toHaveBeenCalled();
});
