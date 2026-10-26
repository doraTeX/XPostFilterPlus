import {t} from './i18n';
import {isConnected,invalidate,isDisconnectedError,disconnectedError} from './connection';
export async function call(type:string,data:Record<string,unknown>={}){
 if(!isConnected())throw disconnectedError();
 try{
  const r=await chrome.runtime.sendMessage({type,...data});
  if(!r?.ok)throw Object.assign(Error(r?.error||t('m_5df2e996fd0d')),{kind:r?.kind,scope:r?.scope,attempted:r?.attempted,elapsedMs:r?.elapsedMs});
  return r.value;
 }catch(error){
  if(isDisconnectedError(error)||!isConnected()){invalidate();throw disconnectedError();}
  throw error;
 }
}
