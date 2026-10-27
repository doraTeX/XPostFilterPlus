import {createSettingsDialog} from '../src/content/settings-dialog';
import {t} from '../src/shared/i18n';
const lang=new URL(location.href).searchParams.get('lang')==='en'?'en':'ja';document.documentElement.lang=lang;
document.getElementById('preview-banner')!.textContent=t('previewNotice');document.getElementById('open-settings')!.textContent=t('actionTitle');
const failSave=new URL(location.href).searchParams.get('save')==='fail';
const base=new URL('/preview/index.html',location.href),editor=createSettingsDialog(()=>base.href);
document.getElementById('open-settings')!.onclick=()=>editor.open(base.href+'?lang='+lang+'&embedded=1'+(failSave?'&save=fail':'')+(new URL(location.href).searchParams.get('state')==='broken'?'&state=broken':'')+'#token=preview-token');
window.addEventListener('message',event=>{if(event.origin===location.origin&&event.data?.type==='XPF_PREVIEW_CLOSED')editor.dispose();});
