import {updateToolbarBadge} from './badge';
import {t} from "../shared/i18n";
import {SyncStore,SYNC_ALARM} from './sync-store';
import {Controller} from './controller.js';
import {aiError} from '../shared/ai-errors.js';
import {SETTINGS,LOCAL} from '../shared/settings';
import {connectionOrigin,connectionIdentity,profileOf} from '../shared/ai.js';
const controller=new Controller(chrome.storage.local,async(url:string,options:RequestInit)=>{
 const abort=new AbortController(),timer=setTimeout(()=>abort.abort(),30000);
 try{const r=await fetch(url,{...options,signal:abort.signal,credentials:'omit',redirect:'error'});const text=await r.text();if(text.length>6000000)throw aiError('','size');return {status:r.status,text,retry:r.headers.get('Retry-After')};}
 catch(e){if(e&&typeof e==='object'&&'kind'in e)throw e;throw aiError('',abort.signal.aborted?'timeout':'network');}finally{clearTimeout(timer);}
},chrome.permissions);
const syncStore=new SyncStore(fn=>controller.settingsTransaction(fn));
async function reconcileSync(){await syncStore.reconcile();}

async function xTabs(){return (await chrome.tabs.query({url:['https://x.com/*','https://twitter.com/*']})).filter(t=>t.id!==undefined);}
async function pageData(tabId?:number,type='SNAPSHOT',details=false){
 const tabs=await xTabs(),tab=tabs.find(t=>t.id===tabId)||(tabId===undefined?[...tabs].sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0]:undefined);
 if(!tab)return {tabs:tabs.map(t=>({id:t.id,title:t.title||'X',url:t.url})),connected:false,message:t("m_5d57e446a85e"),rows:[]};
 try{const data=await chrome.tabs.sendMessage(tab.id!,{type,details});if(!data)throw Error();return {...data,tabId:tab.id,connected:true,tabs:tabs.map(t=>({id:t.id,title:t.title||'X',url:t.url}))};}
 catch{return {tabId:tab.id,connected:false,tabs:tabs.map(t=>({id:t.id,title:t.title||'X',url:t.url})),message:t("m_3a2b164bc69e"),rows:[]};}
}
async function openDashboard(tabId?:number){
 const url=chrome.runtime.getURL('src/dashboard/index.html')+(tabId===undefined?'':'?tab='+tabId);
 const found=(await chrome.tabs.query({})).find(t=>t.url===url);
 if(found?.id!==undefined){await chrome.tabs.update(found.id,{active:true});return;}
 await chrome.tabs.create({url});
}
function context(sender:chrome.runtime.MessageSender){
 if(sender.id!==chrome.runtime.id||!sender.url)return '';
 const u=new URL(sender.url);if(u.protocol==='chrome-extension:'&&u.hostname===chrome.runtime.id)return 'admin';
 return u.protocol==='https:'&&['x.com','twitter.com'].includes(u.hostname)?'page':'';
}
async function handle(m:any,sender:chrome.runtime.MessageSender){
 const access=context(sender);if(!access)throw Error(t("m_0dc6cb2b82d2"));
 if(m.type==='GET')return controller.state(access==='admin');
 if(m.type==='DECIDE'&&access==='page'&&sender.tab?.id!==undefined){if(typeof m.page!=='string'||m.page.length>100)throw Error(t("m_38cd0d1e5fa0"));return controller.decide(m.post,String(sender.tab.id)+':'+m.page);}
 if(m.type==='OPEN')return openDashboard(sender.tab?.id);
 if(m.type==='BADGE')return updateToolbarBadge(m.count,sender,m.error);
 if(access!=='admin')throw Error(t("m_6c5feecbc21d"));
 if(m.type==='SAVE'){const old=await controller.local();await controller.save(m.settings,m.local,m.expected,['editor-save','json-import','history-restore'].includes(m.reason)?m.reason:'editor-save',next=>syncStore.recordLocal(next));await syncStore.queue(()=>reconcileSync());const next=await controller.local();if(connectionIdentity(old)!==connectionIdentity(next)||profileOf(old).key!==profileOf(next).key)await controller.verify();return controller.state(true);}
 if(m.type==='CLEAR')return controller.clear();
 if(m.type==='RESUME')return controller.resume();
 if(m.type==='CLOSE'){if(sender.tab?.id!==undefined)await chrome.tabs.remove(sender.tab.id);return null;}
 if(m.type==='PAGE'||m.type==='PAUSE'){if(m.tabId!==undefined&&!Number.isInteger(m.tabId))throw Error(t("m_18e5f67c26de"));return pageData(m.tabId,m.type==='PAUSE'?'PAUSE':'SNAPSHOT',m.details===true);}
 if(m.type==='SYNC_STATUS')return syncStore.state();
 if(m.type==='SYNC'){await syncStore.queue(()=>reconcileSync());return syncStore.state();}
 if(m.type==='SYNC_ENABLED'){if(typeof m.enabled!=='boolean')throw Error(t("m_495dc1760a51"));await syncStore.queue(async()=>{await syncStore.setEnabled(m.enabled);await reconcileSync();});return syncStore.state();}
 if(m.type==='SYNC_RESOLVE'){await syncStore.queue(async()=>{await syncStore.resolve(m.doc);});return syncStore.state();}
 if(m.type==='REPORT'){
  const data=await pageData(m.tabId,'SNAPSHOT',true),id=crypto.randomUUID();
  const all=await chrome.storage.session.get(null),reports=Object.keys(all).filter(k=>k.startsWith('xpf_report:'));
  if(reports.length>=5)await chrome.storage.session.remove(reports.slice(0,reports.length-4));
  await chrome.storage.session.set({['xpf_report:'+id]:{rows:data.rows,time:Date.now(),url:data.url||'',title:data.title||''}});
  await chrome.tabs.create({url:chrome.runtime.getURL('src/report/index.html')+'?id='+id});return null;
 }
 if(m.type==='REPORT_DATA'){if(typeof m.id!=='string'||!/^[a-f0-9-]{36}$/.test(m.id))throw Error(t("m_7428ab5b0e53"));const key='xpf_report:'+m.id,data=(await chrome.storage.session.get(key))[key];if(!data)throw Error(t("m_28e53e5b1756"));await chrome.storage.session.remove(key);return data;}
 if(m.type==='PERMISSION'){const granted=await chrome.permissions.request({origins:[connectionOrigin(m.provider)]});if(granted&&(await controller.local()).provider===m.provider)await controller.verify();return granted;}
 throw Error(t("m_da25fe15132f"));
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{void handle(m,sender).then(value=>respond({ok:true,value}),e=>respond({ok:false,error:e.message,kind:e.kind,scope:e.scope,attempted:e.attempted,elapsedMs:e.elapsedMs}));return true;});
chrome.action.onClicked.addListener(tab=>{void openDashboard(tab.id);});
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!(SETTINGS in changes||LOCAL in changes))return;void chrome.tabs.query({url:['https://x.com/*','https://twitter.com/*']}).then(tabs=>{for(const tab of tabs)if(tab.id!==undefined)void chrome.tabs.sendMessage(tab.id,{type:'REFRESH'}).catch(()=>{});});});

chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===SYNC_ALARM)void syncStore.queue(()=>reconcileSync());});
chrome.storage.onChanged.addListener((_changes,area)=>{if(area==='sync')void syncStore.queue(()=>reconcileSync());});
void syncStore.queue(()=>reconcileSync());
