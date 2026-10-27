import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({mount:vi.fn(),call:vi.fn()}));
vi.mock('../src/dashboard/ui',()=>({mountDashboard:mocks.mount}));
vi.mock('../src/shared/client',()=>({call:mocks.call}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();document.body.innerHTML='<main id="app"></main>';mocks.mount.mockRejectedValue(Error('Invalid editor token'));});
afterEach(()=>{window.dispatchEvent(new Event('pagehide'));vi.unstubAllGlobals();document.body.replaceChildren();document.documentElement.classList.remove('embedded');});
it('埋め込み設定のGET失敗後は閉じるボタンで認証に依存せず退出を要求する',async()=>{
 const parentWindow={postMessage:vi.fn()};vi.stubGlobal('parent',parentWindow);await import('../src/dashboard/main');await Promise.resolve();
 expect(document.querySelector('[role=alert]')!.textContent).toBe('Invalid editor token');document.querySelector<HTMLButtonElement>('button')!.click();await Promise.resolve();
 expect(parentWindow.postMessage).toHaveBeenCalledWith({type:'XPF_CLOSE_EMPTY'},'*');expect(mocks.call).not.toHaveBeenCalled();
});
it('トップレベルの設定画面でも初期化失敗後にEscで閉じられる',async()=>{
 vi.stubGlobal('parent',window);await import('../src/dashboard/main');await Promise.resolve();
 // トップレベルの設定エラーでは通常のCLOSEを使う。
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await Promise.resolve();expect(mocks.call).toHaveBeenCalledWith('CLOSE',{});
});
