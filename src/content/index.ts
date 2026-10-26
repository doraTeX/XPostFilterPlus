import {start} from './engine.js';
import {call} from '../shared/client';
import {isConnected,onDisconnected,isDisconnectedError} from '../shared/connection';
void start({call,isConnected,onDisconnected,listen:(fn:(m:any)=>any)=>{
 const handler=(m:any,_sender:chrome.runtime.MessageSender,respond:(data:any)=>void)=>{if(!isConnected())return;if(['REFRESH','SNAPSHOT','PAUSE'].includes(m.type)){const result=fn(m);if(m.type!=='REFRESH')respond(result);}};
 try{if(isConnected())chrome.runtime.onMessage.addListener(handler);}catch(error){if(!isDisconnectedError(error))throw error;isConnected();}
 return ()=>{try{chrome.runtime.onMessage.removeListener(handler);}catch{/* 無効化後の解除ではChrome APIを再試行しない。 */}};
}}).catch(error=>{if(!isDisconnectedError(error))console.error('XPostFilterPlus:',error.message);});
