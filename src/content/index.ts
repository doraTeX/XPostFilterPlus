import {start} from './engine.js';
import {createSettingsDialog} from './settings-dialog';
import {call} from '../shared/client';
import {waitForXReady} from './startup';
import {isConnected,onDisconnected,isDisconnectedError} from '../shared/connection';
const editor=createSettingsDialog(path=>chrome.runtime.getURL(path));
onDisconnected(()=>editor.dispose());
async function launch(){
 try{await call('PAGE_READY');}catch(error){if(isDisconnectedError(error)||!isConnected())return;}
 if(!await waitForXReady(isConnected,onDisconnected))return;
 return start({call,isConnected,onDisconnected,listen:(fn:(m:any)=>any)=>{
 const handler=(m:any,sender:chrome.runtime.MessageSender,respond:(data:any)=>void)=>{
  if(!isConnected()||sender.id!==chrome.runtime.id)return;
  if(m.type==='OPEN_SETTINGS'){try{respond(editor.open(m.url));}catch(error){respond({opened:false,error:(error as Error).message});}return;}
  if(m.type==='CLOSE_SETTINGS'){respond(editor.close(m.token));return;}
  if(m.type==='CONFIRM_SETTINGS'||m.type==='COPY_SETTINGS'){void editor.action(m.type,m.token,m.value).then(respond);return true;}
  if(['REFRESH','SNAPSHOT','PAUSE'].includes(m.type)){const result=fn(m);if(m.type!=='REFRESH')respond(result);}
 };
 try{if(isConnected())chrome.runtime.onMessage.addListener(handler);}catch(error){if(!isDisconnectedError(error))throw error;isConnected();}
 return ()=>{try{chrome.runtime.onMessage.removeListener(handler);}catch{/* 無効化後の解除ではChrome APIを再試行しない。 */}};
}});}
void launch().catch(error=>{if(!isDisconnectedError(error))console.error('XPostFilterPlus:',error.message);});
