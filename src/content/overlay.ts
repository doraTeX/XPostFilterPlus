import {t} from '../shared/i18n';
import {createPauseControl} from './pause-control.js';
import {createHoverMenu} from './hover-menu.js';
type Options={open:()=>void;pause:()=>void;release:(reason:string)=>void};
// Y!News Filter Plusのチップ・ホバータグ・進捗・回転矢印のスタイルと挙動を移植。
export function createOverlay(options:Options){
 const host=document.createElement('div');host.id='xpf-overlay';document.documentElement.append(host);const root=host.attachShadow({mode:'closed'});
 root.innerHTML=`<style>
 :host{all:initial;color-scheme:light;font:12px/1.5 system-ui,sans-serif;color:#24415f}*{box-sizing:border-box}[hidden]{display:none!important}
 #wrap{position:fixed;top:8px;right:12px;z-index:2147483646;width:max-content}
 #badge{display:block;margin:0;padding:5px 10px;width:auto;height:auto;border:1px solid #b6c7da;border-radius:999px;background:#f4f8fc;color:#24415f;font:600 12px/1.4 system-ui,sans-serif;box-shadow:0 2px 8px #102a4326;cursor:pointer;letter-spacing:normal}
 #tip{display:none;position:absolute;top:100%;right:0;padding-top:6px;width:max-content;max-width:min(320px,calc(100vw - 24px))}
 #words{display:flex;flex-direction:column;align-items:center;gap:5px;max-height:50vh;overflow:auto;padding:8px;background:#fff;border:1px solid #efcfdd;border-radius:9px;box-shadow:0 3px 12px #55243b22}
 .word{font:500 12px/1.5 system-ui,sans-serif;background:#fce7f0;color:#8a2854;border:1px solid #efb8cf;border-radius:5px;padding:2px 9px;overflow-wrap:anywhere;max-width:100%;box-sizing:border-box;cursor:pointer;appearance:none}.word[aria-pressed="true"]{opacity:.4}.word:focus-visible{outline:2px solid #b94078;outline-offset:2px}.empty{font:12px/1.5 system-ui,sans-serif;color:#775563}
 #busy{position:absolute;right:-4px;bottom:-5px;width:16px;height:16px;pointer-events:none;z-index:2147483647}#busy svg{display:block;width:16px;height:16px;color:#159447;background:#fff;border-radius:50%;animation:spin 1s linear infinite}@keyframes spin{to{transform:rotate(360deg)}}@media(prefers-reduced-motion:reduce){#busy svg{animation:none}}
 #error{position:absolute;right:-4px;bottom:-5px;width:18px;height:18px;padding:0;border:0;border-radius:50%;cursor:pointer;z-index:2147483647;background:#D93025;color:white}
 #progress{position:absolute;top:100%;right:0;width:max-content;max-width:min(280px,calc(100vw - 24px));padding-top:6px}.progress{font:12px/1.5 system-ui,sans-serif;color:#24415f;background:#f4f8fc;border:1px solid #b6c7da;border-radius:9px;padding:8px 10px;box-shadow:0 3px 12px #102a4326;white-space:pre-line;overflow-wrap:anywhere}
 </style><div id="wrap"><button id="badge" type="button"></button><span id="busy" role="status" hidden><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20 10a8 8 0 1 0-2 8M20 4v6h-6" fill="none" stroke="currentColor" stroke-width="2.7" stroke-linecap="round" stroke-linejoin="round"/></svg></span><button id="error" hidden><svg viewBox="0 0 18 18" width="18" height="18" aria-hidden="true"><circle cx="9" cy="9" r="9" fill="#D93025"/><path d="M6 6L12 12M12 6L6 12" stroke="white" stroke-width="2.4" stroke-linecap="round"/></svg></button><div id="progress" hidden><div class="progress" role="status"></div></div><div id="tip"><div id="words"></div></div></div>`;
 const badge=root.querySelector<HTMLButtonElement>('#badge')!,error=root.querySelector<HTMLButtonElement>('#error')!,busy=root.querySelector<HTMLElement>('#busy')!,wrap=root.querySelector<HTMLElement>('#wrap')!,progress=root.querySelector<HTMLElement>('#progress')!,tip=root.querySelector<HTMLElement>('#tip')!,words=root.querySelector<HTMLElement>('#words')!;
 badge.onclick=error.onclick=()=>{hoverMenu.dismiss();options.open();};busy.setAttribute('aria-label',t('chipBusy'));words.setAttribute('aria-label',t('hiddenWords'));
 const pause=createPauseControl({toggle:options.pause,pauseLabel:t('pauseAll'),resumeLabel:t('resumeAll')});wrap.append(pause.host);
 let showChip=true,settingsOpen=false,awaitInteraction=false;
 const resumePointer=(event:PointerEvent)=>{if(!settingsOpen&&(!event.composedPath().includes(host)||!!(event.movementX||event.movementY)))awaitInteraction=false;};
 const resumeKeyboard=(event:KeyboardEvent)=>{if(!settingsOpen&&['Tab','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Home','End','Enter',' '].includes(event.key))awaitInteraction=false;};
 document.addEventListener('pointermove',resumePointer,true);document.addEventListener('keydown',resumeKeyboard,true);
 const hoverMenu=createHoverMenu({container:wrap,root,render:(open:boolean)=>{const visible=showChip&&!settingsOpen&&!awaitInteraction&&open;tip.style.display=visible?'block':'none';pause.setVisible(visible);}});
 let previous='';
 function update(data:{count:number;enabled:boolean;paused:boolean;show:boolean;running:boolean;showProgress:boolean;progress:string;error:string;words:[string,number][];released:Set<string>;reloadRequired?:boolean}){
  pause.update(data.paused,!!data.reloadRequired);showChip=data.show;hoverMenu.refresh();
  const label=data.reloadRequired?t('reloadRequiredShort'):!data.enabled?t('filterOff'):data.paused?t('temporarilyShowing'):t('hiddenCount',[data.count]);badge.textContent=label;badge.title=data.reloadRequired?t('reloadRequired'):data.error?t('chipErrorTitle',[data.error]):t('chipTitle');badge.setAttribute('aria-label',data.reloadRequired?t('reloadRequired'):t('chipLabel',[label]));badge.hidden=!data.show;tip.hidden=!data.show;
  wrap.hidden=!data.show&&!(data.running&&data.showProgress);busy.hidden=!data.show||!data.running||!!data.error;error.hidden=!!data.reloadRequired||!data.show||!data.error;error.title=data.error;error.setAttribute('aria-label',t('chipErrorTitle',[data.error]));progress.hidden=!data.running||!data.showProgress;progress.querySelector('.progress')!.textContent=data.progress;tip.style.top=data.running&&data.showProgress?`calc(100% + ${progress.offsetHeight}px)`:'100%';
  const signature=JSON.stringify([data.words,[...data.released],!!data.reloadRequired]);if(signature===previous)return;previous=signature;
  const existing=new Map(Array.from(words.querySelectorAll<HTMLButtonElement>('button')).map(b=>[b.dataset.reason!,b]));words.querySelector('.empty')?.remove();for(const [reason,b]of existing)if(!data.words.some(([r])=>r===reason))b.remove();
  for(const [reason,count]of data.words){let b=existing.get(reason);if(!b){b=document.createElement('button');b.type='button';b.className='word';b.dataset.reason=reason;b.onclick=()=>options.release(reason);words.append(b);}const label=reason.startsWith('keyword: ')?reason.slice(9):reason,prefix=label.startsWith('AI: ')?'AI: ':'',chars=Array.from(label.slice(prefix.length)),short=prefix+(chars.length>8?chars.slice(0,6).join('')+'…':chars.join(''));b.textContent=`${short} (${count})`;b.disabled=!!data.reloadRequired;b.setAttribute('aria-pressed',String(data.released.has(reason)));b.title=label+' — '+(data.released.has(reason)?t('tagResume'):t('tagRelease'));b.setAttribute('aria-label',`${label} (${count})`);}
  if(!data.words.length){const empty=document.createElement('span');empty.className='empty';empty.textContent=t('noHiddenWords');words.append(empty);}
 }
 function setSettingsOpen(open:boolean){if(settingsOpen===open)return;settingsOpen=open;awaitInteraction=true;hoverMenu.dismiss();}
 return {root,host,update,setSettingsOpen,dispose:()=>{document.removeEventListener('pointermove',resumePointer,true);document.removeEventListener('keydown',resumeKeyboard,true);hoverMenu.dispose();host.remove();}};
}
