import {t} from '../shared/i18n';
// Y!News Filter Plusのタブ別バッジ処理を流用。
export async function updateToolbarBadge(count:unknown,sender:chrome.runtime.MessageSender,error:unknown=''){
 if(!Number.isSafeInteger(count)||Number(count)<0)throw Error(t('invalidHiddenCount'));
 if(sender.tab?.id===undefined||sender.frameId!==0||!sender.url?.startsWith('https://'))return null;
 const tabId=sender.tab.id;
 await chrome.action.setBadgeBackgroundColor({tabId,color:'#D93025'});
 await chrome.action.setBadgeTextColor({tabId,color:'#FFFFFF'});
 await chrome.action.setBadgeText({tabId,text:typeof error==='string'&&error?'×':String(count)});
 await chrome.action.setTitle({tabId,title:typeof error==='string'&&error?t('chipErrorTitle',[error.slice(0,500)]):'XPostFilterPlus'});
 return null;
}
