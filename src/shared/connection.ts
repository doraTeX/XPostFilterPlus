import {t} from './i18n';
let disconnected=false;
const listeners=new Set<()=>void>();

export function showReloadNotice(){
 if(typeof document==='undefined'||document.getElementById('xpf-reload-notice'))return;
 const notice=document.createElement('div');notice.id='xpf-reload-notice';notice.setAttribute('role','alert');
 // Y!News版と同じく、ページの再読み込みが必要なことだけを一度表示する。
 notice.style.cssText='position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483647;background:#fff3bf;color:#172b42;padding:12px 18px;border:1px solid #b58b00;border-radius:8px;font:14px/1.6 system-ui;box-shadow:0 2px 12px #0003';
 notice.textContent=t('reloadRequired');(document.body||document.documentElement).append(notice);
}
export function invalidate(){
 if(disconnected)return;
 disconnected=true;showReloadNotice();for(const listener of [...listeners])listener();listeners.clear();
}
export function isConnected(){
 if(disconnected)return false;
 try{if(typeof chrome!=='undefined'&&chrome.runtime?.id)return true;}catch{}
 invalidate();return false;
}
export function onDisconnected(listener:()=>void){
 if(disconnected){listener();return ()=>{};}
 listeners.add(listener);return ()=>{listeners.delete(listener);};
}
export function isDisconnectedError(error:unknown){return !!error&&typeof error==='object'&&'kind' in error&&error.kind==='disconnected'||/Extension context invalidated/i.test(String(error));}
export function disconnectedError(){return Object.assign(Error(t('reloadRequired')),{kind:'disconnected',scope:'global',attempted:false});}
