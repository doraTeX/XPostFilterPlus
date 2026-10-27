import {t} from '../shared/i18n';
type Panel={host:HTMLElement;dialog:HTMLDialogElement;frame:HTMLIFrameElement;token:string;origin:string;previous:Element|null};
// 枠と開閉だけをページ側へ置き、APIキーを含むUIは別オリジンの拡張フレームに保つ。
export function createSettingsDialog(getURL:(path:string)=>string){
 let panel:Panel|null=null,closeTimer:ReturnType<typeof setTimeout>|undefined;
 function clearCloseTimer(){clearTimeout(closeTimer);closeTimer=undefined;}
 function message(event:MessageEvent){
  if(!panel||event.source!==panel.frame.contentWindow||event.origin!==panel.origin)return;
  if(event.data?.type==='XPF_CLOSE_ACK')clearCloseTimer();
  if(event.data?.type==='XPF_CLOSE_EMPTY')dispose();
 }
 function dispose(){const current=panel;if(!current)return;panel=null;clearCloseTimer();window.removeEventListener('message',message);if(current.dialog.open)current.dialog.close();current.host.remove();if(current.previous instanceof HTMLElement&&current.previous.isConnected)current.previous.focus({preventScroll:true});}
 function requestClose(){
  const current=panel;if(!current)return;
  // 応答のない壊れたフレームだけを閉じる。編集中・保存待ちはACKで保持する。
  if(closeTimer===undefined)closeTimer=setTimeout(()=>{closeTimer=undefined;if(panel===current)dispose();},1500);
  current.frame.contentWindow?.postMessage({type:'XPF_REQUEST_CLOSE'},current.origin);
 }
 function open(value:string){
  const url=new URL(value),expected=new URL(getURL('src/dashboard/index.html')),token=new URLSearchParams(url.hash.slice(1)).get('token');
  if(url.protocol!==expected.protocol||url.host!==expected.host||url.pathname!==expected.pathname||url.searchParams.get('embedded')!=='1'||!token)throw Error(t('m_0dc6cb2b82d2'));
  if(panel?.token===token&&panel.host.isConnected){panel.frame.focus();return {opened:true};}
  dispose();const previous=document.activeElement,host=document.createElement('div');host.id='xpf-settings-host';host.style.setProperty('all','initial','important');
  const root=host.attachShadow({mode:'closed'}),style=document.createElement('style');
  style.textContent=`:host{all:initial;color-scheme:light}dialog{width:min(720px,calc(100vw - 32px));max-width:720px;height:calc(100dvh - 40px);max-height:calc(100dvh - 40px);margin:auto;padding:0;border:1px solid #b5c4d4;border-radius:16px;background:#fff;color:#172b42;box-shadow:0 20px 80px #102a4350;overflow:hidden;box-sizing:border-box}dialog::backdrop{background:#0003}iframe{display:block;width:100%;height:100%;border:0;background:white}`;
  const dialog=document.createElement('dialog'),frame=document.createElement('iframe');dialog.setAttribute('aria-label',t('actionTitle'));frame.title=t('actionTitle');frame.allow='clipboard-write';frame.referrerPolicy='no-referrer';
  panel={host,dialog,frame,token,origin:url.protocol+'//'+url.host,previous};
  window.addEventListener('message',message);
  dialog.addEventListener('cancel',event=>{event.preventDefault();requestClose();});
  // cancelを取り消せない連続Escでも、設定フレームは保存完了まで保持する。
  dialog.addEventListener('close',()=>{if(panel?.dialog===dialog){dialog.showModal();frame.focus();requestClose();}});
  dialog.append(frame);root.append(style,dialog);document.documentElement.append(host);frame.src=url.href;dialog.showModal();frame.focus();return {opened:true};
 }
 function close(token:unknown){if(panel?.token!==token)return {closed:false};dispose();return {closed:true};}
 async function action(type:'CONFIRM_SETTINGS'|'COPY_SETTINGS',token:unknown,value:unknown){
  if(!panel||panel.token!==token||typeof value!=='string')return {ok:false};
  try{if(type==='CONFIRM_SETTINGS')return {ok:true,value:window.confirm(value)};await navigator.clipboard.writeText(value);return {ok:true,value:true};}
  catch(error){return {ok:false,error:(error as Error).message};}
 }
 return {open,close,action,dispose};
}
