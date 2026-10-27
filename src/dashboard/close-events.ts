// Escと親ダイアログの閉じる要求を、保存待ちを含む同じ処理へ集約する。
export function bindCloseEvents(close:()=>Promise<unknown>|undefined,embedded:boolean,parentOrigins=['https://x.com','https://twitter.com']){
 const request=()=>{void close()?.catch(()=>{});};
 const keydown=(event:KeyboardEvent)=>{if(event.key==='Escape'&&!event.isComposing){event.preventDefault();request();}};
 const message=(event:MessageEvent)=>{if(embedded&&event.source===parent&&parentOrigins.includes(event.origin)&&event.data?.type==='XPF_REQUEST_CLOSE')request();};
 window.addEventListener('keydown',keydown);window.addEventListener('message',message);
 return ()=>{window.removeEventListener('keydown',keydown);window.removeEventListener('message',message);};
}
