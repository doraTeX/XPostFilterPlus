import {t,language} from '../shared/i18n';
import {mountDashboard} from './ui';
import {observeSettings} from './settings-events';
import {call} from '../shared/client';
import {connectionOrigin} from '../shared/ai.js';
import {bindCloseEvents} from './close-events';
import {renderSettingsError} from './error';
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
async function requestClose(){
 if(dashboard)return dashboard.close();
 // 認証やGET自体が失敗した場合も、未作成の編集画面からは退出できる。
 if(embedded)parent.postMessage({type:'XPF_CLOSE_EMPTY'},'*');
 else await invoke('CLOSE');
}
const unbindClose=bindCloseEvents(requestClose,embedded);
window.addEventListener('pagehide',()=>{unbindClose();dashboard?.dispose();},{once:true});
void mountDashboard(document.getElementById('app')!,{
 call:invoke,
 ...(embedded?{confirm:async(value:string)=>!!await invoke('CONFIRM',{value}),copy:async(value:string)=>{await invoke('COPY',{value});}}:{}),
 onChange:observeSettings
}).then(value=>{dashboard=value;dashboard.focus();}).catch(e=>{renderSettingsError(document.getElementById('app')!,e,requestClose);});
