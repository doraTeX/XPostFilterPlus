import {SETTINGS,LOCAL} from '../shared/settings';
// 埋め込み・拡張リロード時にstorage APIがなくても設定画面を初期化できる。
export function observeSettings(fn:()=>void){
 const listener=(changes:Record<string,chrome.storage.StorageChange>,area:string)=>{
  if(area==='local'&&(SETTINGS in changes||LOCAL in changes||'xpf_sync_state' in changes))fn();
 };
 try{
  const changed=typeof chrome==='undefined'?undefined:chrome.storage?.onChanged;
  if(changed){
   changed.addListener(listener);
   // リロード後はchrome.storageを参照し直さず、解除失敗も画面終了を妨げない。
   return ()=>{try{changed.removeListener(listener);}catch{}};
  }
 }catch{/* 通知登録が利用できない場合は同じ認証済みGETで確認する。 */}
 const timer=setInterval(fn,1500);
 return ()=>clearInterval(timer);
}
