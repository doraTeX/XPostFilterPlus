import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {createSettingsDialog} from '../src/content/settings-dialog';
let editor:ReturnType<typeof createSettingsDialog>;
const url='chrome-extension://test-extension/src/dashboard/index.html?embedded=1&tab=1#token=test-token';
beforeEach(()=>{
 const attach=Element.prototype.attachShadow;vi.spyOn(Element.prototype,'attachShadow').mockImplementation(function(this:Element,options){return attach.call(this,{...options,mode:'open'});});
 HTMLDialogElement.prototype.showModal=function(){this.open=true;};HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new Event('close'));};
 editor=createSettingsDialog(path=>'chrome-extension://test-extension/'+path);
});
afterEach(()=>{editor.dispose();document.body.replaceChildren();vi.restoreAllMocks();});
it('元のページを残し、一つのモーダルに設定フレームを重ねる',()=>{
 document.body.innerHTML='<main>元のタイムライン</main>';
 expect(editor.open(url)).toEqual({opened:true});const host=document.getElementById('xpf-settings-host')!,root=host.shadowRoot!;
 expect(root.querySelector('dialog')!.open).toBe(true);expect(root.querySelector('iframe')!.src).toBe(url);
 editor.open(url);expect(document.querySelectorAll('#xpf-settings-host')).toHaveLength(1);expect(document.querySelector('main')!.textContent).toBe('元のタイムライン');
 expect(root.querySelector('iframe')!.title).toContain('XPostFilterPlus');expect(editor.close('wrong')).toEqual({closed:false});
 editor.close('test-token');expect(document.getElementById('xpf-settings-host')).toBeNull();expect(document.querySelector('main')).not.toBeNull();
});
it('Escでは即座に消さず、設定フレームへ保存して閉じる要求を送る',()=>{
 editor.open(url);const root=document.getElementById('xpf-settings-host')!.shadowRoot!,dialog=root.querySelector('dialog')!,frame=root.querySelector('iframe')!;
 // jsdomはShadow DOM内のフレームWindowを作らないため、メッセージ送信先だけ補う。
 const post=vi.fn();Object.defineProperty(frame,'contentWindow',{value:{postMessage:post}});const event=new Event('cancel',{cancelable:true});dialog.dispatchEvent(event);
 expect(event.defaultPrevented).toBe(true);expect(dialog.open).toBe(true);
 expect(post).toHaveBeenCalledWith({type:'XPF_REQUEST_CLOSE'},'chrome-extension://test-extension');
});
it('他の接続先や拡張内の別ページをフレームとして開かない',()=>{
 expect(()=>editor.open('https://example.com/?embedded=1#token=test')).toThrow();
 expect(()=>editor.open(url.replace('dashboard','report'))).toThrow();expect(document.getElementById('xpf-settings-host')).toBeNull();
});
it('確認ダイアログは元ページで表示し、トークンが不正なら実行しない',async()=>{
 editor.open(url);const confirm=vi.spyOn(window,'confirm').mockReturnValue(true);
 expect(await editor.action('CONFIRM_SETTINGS','wrong','消去しますか？')).toEqual({ok:false});expect(confirm).not.toHaveBeenCalled();
 expect(await editor.action('CONFIRM_SETTINGS','test-token','消去しますか？')).toEqual({ok:true,value:true});expect(confirm).toHaveBeenCalledWith('消去しますか？');
});
