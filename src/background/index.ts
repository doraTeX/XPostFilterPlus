import {updateToolbarBadge} from './badge';
import {EditorHost,isXPage} from './editor';
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
const editor=new EditorHost();
const syncStore=new SyncStore(fn=>controller.settingsTransaction(fn));
async function reconcileSync(){await syncStore.reconcile();}
let reportsWriting:Promise<unknown>=Promise.resolve();
function reportTransaction<T>(run:()=>Promise<T>){const next=reportsWriting.then(run,run);reportsWriting=next.catch(()=>{});return next;}

async function xTabs(){return (await chrome.tabs.query({url:['https://x.com/*','https://twitter.com/*']})).filter(t=>t.id!==undefined);}
async function pageData(tabId?:number,type='SNAPSHOT',details=false){
 const tabs=await xTabs(),tab=tabs.find(t=>t.id===tabId)||(tabId===undefined?[...tabs].sort((a,b)=>(b.lastAccessed||0)-(a.lastAccessed||0))[0]:undefined);
 if(!tab)return {tabs:tabs.map(t=>({id:t.id,title:t.title||'X',url:t.url})),connected:false,message:t("m_5d57e446a85e"),rows:[]};
 try{const data=await chrome.tabs.sendMessage(tab.id!,{type,details});if(!data)throw Error();return {...data,tabId:tab.id,connected:true,tabs:tabs.map(t=>({id:t.id,title:t.title||'X',url:t.url}))};}
 catch{return {tabId:tab.id,connected:false,tabs:tabs.map(t=>({id:t.id,title:t.title||'X',url:t.url})),message:t("m_3a2b164bc69e"),rows:[]};}
}
async function context(sender:chrome.runtime.MessageSender,token:unknown){
 if(sender.id!==chrome.runtime.id||!sender.url)return '';
 const u=new URL(sender.url);if(u.protocol==='chrome-extension:'&&u.hostname===chrome.runtime.id){
  if(sender.frameId)return await editor.authorized(sender,token)?'admin':'';
  return 'admin';
 }
 return u.protocol==='https:'&&['x.com','twitter.com'].includes(u.hostname)&&!sender.frameId?'page':'';
}
async function handle(m:any,sender:chrome.runtime.MessageSender){
 const access=await context(sender,m.editorToken);if(!access)throw Error(t("m_0dc6cb2b82d2"));
 if(m.type==='GET')return controller.state(access==='admin');
 if(m.type==='PAGE_READY'&&access==='page'&&sender.tab?.id!==undefined){await editor.forget(sender.tab.id);return null;}
 if(m.type==='DECIDE'&&access==='page'&&sender.tab?.id!==undefined){if(typeof m.page!=='string'||m.page.length>100)throw Error(t("m_38cd0d1e5fa0"));return controller.decide(m.post,String(sender.tab.id)+':'+m.page);}
 if(m.type==='OPEN')return editor.open(sender.tab?.id);
 if(m.type==='BADGE')return updateToolbarBadge(m.count,sender,m.error);
 if(access!=='admin')throw Error(t("m_6c5feecbc21d"));
 if(sender.frameId&&['PAGE','PAUSE','REPORT'].includes(m.type))m={...m,tabId:sender.tab!.id};
 if(m.type==='SAVE'){const old=await controller.local();await controller.save(m.settings,m.local,m.expected,['editor-save','json-import','history-restore'].includes(m.reason)?m.reason:'editor-save',next=>syncStore.recordLocal(next));await syncStore.queue(()=>reconcileSync());const next=await controller.local();if(connectionIdentity(old)!==connectionIdentity(next)||profileOf(old).key!==profileOf(next).key)await controller.verify();return controller.state(true);}
 if(m.type==='CLEAR')return controller.clear();
 if(m.type==='RESUME')return controller.resume();
 if(m.type==='CLOSE'){await editor.close(sender,m.editorToken);return null;}
 if(m.type==='CONFIRM')return editor.forward(sender,m.editorToken,'CONFIRM_SETTINGS',m.value);
 if(m.type==='COPY')return editor.forward(sender,m.editorToken,'COPY_SETTINGS',m.value);
 if(m.type==='PAGE'||m.type==='PAUSE'){if(m.tabId!==undefined&&!Number.isInteger(m.tabId))throw Error(t("m_18e5f67c26de"));return pageData(m.tabId,m.type==='PAUSE'?'PAUSE':'SNAPSHOT',m.details===true);}
 if(m.type==='SYNC_STATUS')return syncStore.state();
 if(m.type==='SYNC'){await syncStore.queue(()=>reconcileSync());return syncStore.state();}
 if(m.type==='SYNC_ENABLED'){if(typeof m.enabled!=='boolean')throw Error(t("m_495dc1760a51"));await syncStore.queue(async()=>{await syncStore.setEnabled(m.enabled);await reconcileSync();});return syncStore.state();}
 if(m.type==='SYNC_RESOLVE'){await syncStore.queue(async()=>{await syncStore.resolve(m.doc);});return syncStore.state();}
 if(m.type==='REPORT')return reportTransaction(async()=>{
  const data=await pageData(m.tabId,'SNAPSHOT',true),id=crypto.randomUUID(),key='xpf_report:'+id;
  const report={rows:data.rows,time:Date.now(),url:data.url||'',title:data.title||''},bytes=(value:unknown)=>new TextEncoder().encode(JSON.stringify(value)).length,limit=6*1024*1024;
  if(bytes({[key]:report})>limit)throw Error(t('reportTooLarge'));
  const all=await chrome.storage.session.get(null),reports=Object.keys(all).filter(k=>k.startsWith('xpf_report:')).sort((a,b)=>(all[a].time||0)-(all[b].time||0)),future={...all,[key]:report},remove:string[]=[];
  // 再読み込み用の表は最新5件・合計6MBまで。UUIDの順序を作成日時として扱わない。
  while(reports.length>=5||bytes(future)>limit){const oldest=reports.shift();if(!oldest)break;delete future[oldest];remove.push(oldest);}
  if(remove.length)await chrome.storage.session.remove(remove);
  await chrome.storage.session.set({[key]:report});
  await chrome.tabs.create({url:chrome.runtime.getURL('src/report/index.html')+'?id='+id});return null;
 });
 if(m.type==='REPORT_DATA'){if(typeof m.id!=='string'||!/^[a-f0-9-]{36}$/.test(m.id))throw Error(t("m_7428ab5b0e53"));const key='xpf_report:'+m.id,data=(await chrome.storage.session.get(key))[key];if(!data)throw Error(t("m_28e53e5b1756"));return data;}
 if(m.type==='PERMISSION'){const granted=await chrome.permissions.request({origins:[connectionOrigin(m.provider)]});if(granted&&(await controller.local()).provider===m.provider)await controller.verify();return granted;}
 if(m.type==='PERMISSION_GRANTED'){const granted=await chrome.permissions.contains({origins:[connectionOrigin(m.provider)]});if(granted&&(await controller.local()).provider===m.provider)await controller.verify();return granted;}
 throw Error(t("m_da25fe15132f"));
}
chrome.runtime.onMessage.addListener((m,sender,respond)=>{void handle(m,sender).then(value=>respond({ok:true,value}),e=>respond({ok:false,error:e.message,kind:e.kind,scope:e.scope,attempted:e.attempted,elapsedMs:e.elapsedMs}));return true;});
chrome.action.onClicked.addListener(tab=>{void editor.open(tab.id).catch(error=>{if(tab.id!==undefined)void chrome.action.setTitle({tabId:tab.id,title:error.message});});});
chrome.tabs.onRemoved.addListener(tabId=>{void editor.forget(tabId);});
chrome.tabs.onUpdated.addListener((tabId,change)=>{if(change.url&&!isXPage(change.url))void editor.forget(tabId);});
chrome.storage.local.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});
chrome.storage.session.setAccessLevel({accessLevel:'TRUSTED_CONTEXTS'}).catch(()=>{});
chrome.storage.onChanged.addListener((changes,area)=>{if(area!=='local'||!(SETTINGS in changes||LOCAL in changes))return;void chrome.tabs.query({url:['https://x.com/*','https://twitter.com/*']}).then(tabs=>{for(const tab of tabs)if(tab.id!==undefined)void chrome.tabs.sendMessage(tab.id,{type:'REFRESH'}).catch(()=>{});});});

chrome.alarms.onAlarm.addListener(alarm=>{if(alarm.name===SYNC_ALARM)void syncStore.queue(()=>reconcileSync());});
chrome.storage.onChanged.addListener((_changes,area)=>{if(area==='sync')void syncStore.queue(()=>reconcileSync());});
void syncStore.queue(()=>reconcileSync());
