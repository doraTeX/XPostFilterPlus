import {beforeEach,afterEach,it,expect,vi} from 'vitest';
const mocks=vi.hoisted(()=>({mount:vi.fn(),call:vi.fn()}));
vi.mock('../src/dashboard/ui',()=>({mountDashboard:mocks.mount}));
vi.mock('../src/shared/client',()=>({call:mocks.call}));
beforeEach(()=>{vi.resetModules();vi.clearAllMocks();HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new Event('close'));};Object.defineProperty(location,'ancestorOrigins',{configurable:true,value:['https://x.com']});document.body.innerHTML='<main id="app"></main>';mocks.mount.mockRejectedValue(Error('Invalid editor token'));});
afterEach(()=>{window.dispatchEvent(new Event('pagehide'));vi.unstubAllGlobals();Reflect.deleteProperty(location,'ancestorOrigins');document.body.replaceChildren();document.documentElement.classList.remove('embedded');});
it.each(['https://x.com','https://twitter.com'])('埋め込み設定のGET失敗後も実際の親%sだけへ退出を要求する',async origin=>{
 Object.defineProperty(location,'ancestorOrigins',{configurable:true,value:[origin]});
 const parentWindow={postMessage:vi.fn()};vi.stubGlobal('parent',parentWindow);await import('../src/dashboard/main');await Promise.resolve();
 expect(document.querySelector('[role=alert]')!.textContent).toBe('Invalid editor token');document.querySelector<HTMLButtonElement>('button')!.click();await Promise.resolve();
 expect(parentWindow.postMessage).toHaveBeenCalledExactlyOnceWith({type:'XPF_CLOSE_EMPTY'},origin);expect(mocks.call).not.toHaveBeenCalled();
});
it('トップレベルの設定画面でも初期化失敗後にEscで閉じられる',async()=>{
 vi.stubGlobal('parent',window);await import('../src/dashboard/main');await Promise.resolve();
 // 専用ページではタブを残し、エラーダイアログだけを閉じる。
 window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await Promise.resolve();expect(document.querySelector('dialog')!.open).toBe(false);expect(mocks.call).not.toHaveBeenCalled();expect(document.querySelector('.settings-page')).not.toBeNull();
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

it.each(['ja','en'])('専用ページの入口を%sで表示し、保存後はタブを残して閉じ、設定を再表示できる',async lang=>{
 document.documentElement.lang=lang;vi.stubGlobal('parent',window);let api:any,finish!:()=>void;
 const focus=vi.fn(),close=vi.fn(async()=>{await new Promise<void>(resolve=>{finish=resolve;});await api.call('CLOSE');});
 mocks.mount.mockImplementation(async(_root,bridge)=>{api=bridge;return {close,focus,dispose:vi.fn()};});
 await import('../src/dashboard/main');await Promise.resolve();const page=document.querySelector('.settings-page')!,dialog=document.querySelector('dialog')!,button=page.querySelector<HTMLButtonElement>('button')!;
 expect(page.textContent).toContain(lang==='ja'?'設定は自動保存されます。':'Settings are saved automatically.');expect(page.textContent).toContain(lang==='ja'?'AIの接続先とAPIキーは各端末で設定します。':'Set up the AI provider and API key on each device.');expect(page.querySelector('a')!.href).toBe('https://x.com/home');
 expect(dialog.open).toBe(true);window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await Promise.resolve();expect(dialog.open).toBe(true);finish();await Promise.resolve();await Promise.resolve();expect(dialog.open).toBe(false);expect(mocks.call).not.toHaveBeenCalledWith('CLOSE',expect.anything());
 button.click();expect(dialog.open).toBe(true);expect(mocks.mount).toHaveBeenCalledTimes(1);expect(focus).toHaveBeenCalled();
});
it('専用ページのダイアログも入力中のEsc・強制close・保存失敗で破棄しない',async()=>{
 vi.stubGlobal('parent',window);const close=vi.fn(async()=>{throw Error('保存失敗');});
 mocks.mount.mockImplementation(async()=>({close,focus:vi.fn(),dispose:vi.fn()}));await import('../src/dashboard/main');await Promise.resolve();
 const dialog=document.querySelector('dialog')!,field=document.createElement('textarea');document.getElementById('app')!.append(field);field.value='未保存の条件';field.focus();const cancel=new Event('cancel',{cancelable:true});dialog.dispatchEvent(cancel);expect(cancel.defaultPrevented).toBe(true);expect(close).not.toHaveBeenCalled();
 dialog.close();expect(dialog.open).toBe(true);expect(field.value).toBe('未保存の条件');expect(document.activeElement).toBe(field);
 field.blur();window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape'}));await Promise.resolve();expect(close).toHaveBeenCalledOnce();expect(dialog.open).toBe(true);expect(field.value).toBe('未保存の条件');
});
