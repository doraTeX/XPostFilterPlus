import {createSettingsDialog} from '../src/content/settings-dialog';
import {createOverlay} from '../src/content/overlay';
import {t} from '../src/shared/i18n';
const lang=new URL(location.href).searchParams.get('lang')==='en'?'en':'ja';document.documentElement.lang=lang;
document.getElementById('preview-banner')!.textContent=t('previewNotice');document.getElementById('open-settings')!.textContent=t('actionTitle');
const failSave=new URL(location.href).searchParams.get('save')==='fail';
let closeCheck=0;
const base=new URL('/preview/index.html',location.href),editor=createSettingsDialog(()=>base.href,visible=>{
 overlay.setSettingsOpen(visible);const check=++closeCheck;if(visible)return;
 const frames:string[]=[];const sample=()=>{if(check!==closeCheck)return;frames.push(getComputedStyle(overlay.root.querySelector('#tip')!).display);document.documentElement.dataset.closeTagFrames=JSON.stringify(frames);if(frames.length<8)requestAnimationFrame(sample);};sample();
});
const openSettings=()=>editor.open(base.href+'?lang='+lang+'&embedded=1'+(failSave?'&save=fail':'')+(new URL(location.href).searchParams.get('state')==='broken'?'&state=broken':'')+'#token=preview-token');
document.getElementById('open-settings')!.onclick=openSettings;
const state={count:2,enabled:true,paused:false,show:true,running:false,showProgress:false,progress:'',error:'',words:[['keyword: サンプル',1],['AI: 攻撃的口調',1]] as [string,number][],released:new Set<string>()};
const overlay=createOverlay({open:openSettings,pause:()=>{state.paused=!state.paused;overlay.update(state);},release:reason=>{state.released.has(reason)?state.released.delete(reason):state.released.add(reason);overlay.update(state);}});overlay.update(state);
window.addEventListener('pagehide',()=>overlay.dispose(),{once:true});
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='XPF_PREVIEW_CLOSED')editor.dispose();});
