import {t,language} from '../shared/i18n';
import {mountDashboard} from './ui';
import {SETTINGS,LOCAL} from '../shared/settings';
import {call} from '../shared/client';
document.documentElement.lang=language();document.title=t('actionTitle');
void mountDashboard(document.getElementById('app')!,{call,onChange:(fn:()=>void)=>{const listener=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{if(area==='local'&&(SETTINGS in changes||LOCAL in changes||'xpf_sync_state' in changes))fn();};chrome.storage.onChanged.addListener(listener);return ()=>chrome.storage.onChanged.removeListener(listener);}}).catch(e=>{document.getElementById('app')!.textContent=e.message;});
