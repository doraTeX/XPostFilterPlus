// Xの入口で認証・ルーティング中はDOMを変更せず、アプリ側の画面準備を待つ。
// 空の検索結果にも設定を開けるよう、ポストの存在は起動条件にしない。
export function waitForXReady(isConnected:()=>boolean,onDisconnected:(listener:()=>void)=>(()=>void)|void):Promise<boolean>{
 const ready=()=>location.pathname!=='/'&&document.querySelector('main')!==null;
 if(!isConnected())return Promise.resolve(false);
 if(ready())return Promise.resolve(true);
 return new Promise(resolve=>{
  let finished=false,stop=()=>{};
  const finish=(value:boolean)=>{if(finished)return;finished=true;clearInterval(timer);stop();resolve(value);};
  const check=()=>{if(!isConnected())finish(false);else if(ready())finish(true);};
  const timer=setInterval(check,250);
  const unlisten=onDisconnected(()=>finish(false));
  if(unlisten){if(finished)unlisten();else stop=unlisten;}
  check();
 });
}
