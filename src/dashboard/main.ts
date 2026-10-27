import {t,language} from '../shared/i18n';
import {mountDashboard} from './ui';
import {SETTINGS,LOCAL} from '../shared/settings';
import {call} from '../shared/client';
import {connectionOrigin} from '../shared/ai.js';
import {bindCloseEvents} from './close-events';
document.documentElement.lang=language();document.title=t('actionTitle');
const embedded=window.parent!==window,editorToken=new URLSearchParams(location.hash.slice(1)).get('token');
document.documentElement.classList.toggle('embedded',embedded);
const invoke=(type:string,data:Record<string,unknown>={})=>{
 const payload={...data,...(embedded?{editorToken}:{})};
 // 許可要求はボタンのユーザー操作中に直接開始し、トークン確認の非同期待ちを挟まない。
 if(type==='PERMISSION')return chrome.permissions.request({origins:[connectionOrigin(data.provider)]}).then(granted=>granted?call('PERMISSION_GRANTED',payload):false);
 return call(type,payload);
};
let dashboard:Awaited<ReturnType<typeof mountDashboard>>|undefined;
const unbindClose=bindCloseEvents(()=>dashboard?.close(),embedded);
window.addEventListener('pagehide',()=>{unbindClose();dashboard?.dispose();},{once:true});
void mountDashboard(document.getElementById('app')!,{
 call:invoke,
 ...(embedded?{confirm:async(value:string)=>!!await invoke('CONFIRM',{value}),copy:async(value:string)=>{await invoke('COPY',{value});}}:{}),
 onChange:(fn:()=>void)=>{const listener=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local'&&(SETTINGS in changes||LOCAL in changes||'xpf_sync_state' in changes))fn();};chrome.storage.onChanged.addListener(listener);return ()=>chrome.storage.onChanged.removeListener(listener);}
}).then(value=>{dashboard=value;dashboard.focus();}).catch(e=>{document.getElementById('app')!.textContent=e.message;});
