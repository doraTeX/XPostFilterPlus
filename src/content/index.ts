import {start} from './engine.js';
import {createSettingsDialog} from './settings-dialog';
import {call} from '../shared/client';
import {t} from '../shared/i18n';
import {waitForXReady} from './startup';
import {isConnected,onDisconnected,isDisconnectedError} from '../shared/connection';
let filterHandler:((m:any)=>any)|undefined,listening=false,settingsOpen=false;
const editor=createSettingsDialog(path=>chrome.runtime.getURL(path),visible=>{settingsOpen=visible;filterHandler?.({type:'SETTINGS_VISIBILITY',visible});});
function waitingSnapshot(){return {url:location.href,title:document.title,initializing:true,paused:false,hiddenWords:[],summary:{},stats:{},rows:[],message:t('xPageWaiting')};}
function handleMessage(m:any,sender:chrome.runtime.MessageSender,respond:(data:any)=>void){
 if(!isConnected()||sender.id!==chrome.runtime.id)return;
 if(m.type==='OPEN_SETTINGS'){try{respond(editor.open(m.url));}catch(error){respond({opened:false,error:(error as Error).message});}return;}
 if(m.type==='CLOSE_SETTINGS'){respond(editor.close(m.token));return;}
 if(m.type==='CONFIRM_SETTINGS'||m.type==='COPY_SETTINGS'){void editor.action(m.type,m.token,m.value).then(respond);return true;}
 if(['REFRESH','SNAPSHOT','PAUSE','DEBUG_CHANGED'].includes(m.type)){
  const result=filterHandler?filterHandler(m):waitingSnapshot();if(m.type!=='REFRESH')respond(result);
 }
}
function stopMessages(){
 filterHandler=undefined;if(!listening)return;listening=false;
 try{chrome.runtime.onMessage.removeListener(handleMessage);}catch{/* 無効化後の解除ではChrome APIを再試行しない。 */}
}
onDisconnected(()=>{editor.dispose();stopMessages();});
async function launch(){
 try{await call('PAGE_READY');}catch(error){if(isDisconnectedError(error)||!isConnected())return;}
 // 古いフレーム許可の失効後、画面準備待ちより前に設定の入口を用意する。
 try{if(!isConnected())return;chrome.runtime.onMessage.addListener(handleMessage);listening=true;}
 catch(error){if(!isDisconnectedError(error))throw error;isConnected();return;}
 if(!await waitForXReady(isConnected,onDisconnected)){stopMessages();return;}
 return start({call,isConnected,onDisconnected,listen:(fn:(m:any)=>any)=>{
  filterHandler=fn;fn({type:'SETTINGS_VISIBILITY',visible:settingsOpen});return ()=>{if(filterHandler===fn)filterHandler=undefined;};
 }});
}
void launch().catch(error=>{if(!isDisconnectedError(error))console.error('XPostFilterPlus:',error.message);});
