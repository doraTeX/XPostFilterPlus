import {openExistingSettingsPage} from '../shared/settings-page-events';
import {t} from '../shared/i18n';
const PREFIX='xpf_editor:';
export function isXPage(value?:string){try{const u=new URL(value||'');return u.protocol==='https:'&&['x.com','twitter.com'].includes(u.hostname);}catch{return false;}}
// 公開HTMLをXが勝手に埋め込んでも、設定・キーへアクセスできないようタブごとに許可する。
export class EditorHost{
 private opening=new Map<number,Promise<void>>();
 async open(tabId?:number){
  const tab=tabId===undefined?(await chrome.tabs.query({active:true,currentWindow:true}))[0]:await chrome.tabs.get(tabId);
  if(tab&&await openExistingSettingsPage(tab))return;
  if(tab?.id===undefined||!isXPage(tab.url)){await chrome.runtime.openOptionsPage();return;}
  const id=tab.id,previous=this.opening.get(id)||Promise.resolve();
  const next=previous.catch(()=>{}).then(async()=>{
   const key=PREFIX+id,old=(await chrome.storage.session.get(key))[key],token=old?.token||crypto.randomUUID();
   await chrome.storage.session.set({[key]:{token}});
   const url=chrome.runtime.getURL('src/dashboard/index.html')+'?embedded=1&tab='+id+'#token='+token;
   try{const reply=await chrome.tabs.sendMessage(id,{type:'OPEN_SETTINGS',url},{frameId:0});if(!reply?.opened)throw Error();}
   catch{await chrome.storage.session.remove(key);await this.fallback(id);}
  });
  this.opening.set(id,next);try{await next;}finally{if(this.opening.get(id)===next)this.opening.delete(id);}
 }
 async fallback(tabId:number){
  const url=chrome.runtime.getURL('src/dashboard/index.html')+'?tab='+tabId+'&reload=1';
  const existing=(await chrome.tabs.query({})).find(tab=>tab.url===url);
  if(existing?.id!==undefined)await chrome.tabs.update(existing.id,{active:true});
  else await chrome.tabs.create({url});
 }
 async authorized(sender:chrome.runtime.MessageSender,token:unknown){
  if(sender.tab?.id===undefined||!isXPage(sender.tab.url)||!sender.frameId||typeof token!=='string')return false;
  try{const url=new URL(sender.url||''),expected=new URL(chrome.runtime.getURL('src/dashboard/index.html'));if(url.protocol!==expected.protocol||url.host!==expected.host||url.pathname!==expected.pathname)return false;}catch{return false;}
  return (await chrome.storage.session.get(PREFIX+sender.tab.id))[PREFIX+sender.tab.id]?.token===token;
 }
 async close(sender:chrome.runtime.MessageSender,token:unknown){
  if(sender.tab?.id===undefined)return;
  if(sender.frameId){const reply=await chrome.tabs.sendMessage(sender.tab.id,{type:'CLOSE_SETTINGS',token},{frameId:0});if(!reply?.closed)throw Error(t('reloadRequired'));await this.forget(sender.tab.id);}
  else await chrome.tabs.remove(sender.tab.id);
 }
 async forward(sender:chrome.runtime.MessageSender,token:unknown,type:'CONFIRM_SETTINGS'|'COPY_SETTINGS',value:unknown){
  if(!sender.frameId||sender.tab?.id===undefined||typeof value!=='string'||value.length>(type==='CONFIRM_SETTINGS'?5000:5000000))throw Error(t('m_0dc6cb2b82d2'));
  const reply=await chrome.tabs.sendMessage(sender.tab.id,{type,token,value},{frameId:0});
  if(!reply?.ok)throw Error(reply?.error||t('reloadRequired'));return reply.value;
 }
 async forget(tabId:number){await chrome.storage.session.remove(PREFIX+tabId);}
}
