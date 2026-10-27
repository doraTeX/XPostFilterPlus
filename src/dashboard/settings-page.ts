import {t} from '../shared/i18n';
// 設定専用ページでも、入口を残して保存後にダイアログだけを閉じる。
export function createSettingsPage(root:HTMLElement,requestClose:()=>Promise<unknown>,focus:()=>void){
 const page=document.createElement('section');page.className='settings-page';
 const title=document.createElement('h1');title.textContent='XPostFilterPlus';page.append(title);
 for(const key of ['settingsPageAutosave','settingsPageCredentials']){const p=document.createElement('p');p.textContent=t(key);page.append(p);}
 const actions=document.createElement('div');actions.className='settings-page-actions';page.append(actions);
 const openButton=document.createElement('button');openButton.type='button';openButton.textContent=t('settingsPageOpen');actions.append(openButton);
 const link=document.createElement('a');link.href='https://x.com/home';link.textContent=t('settingsPageOpenX');actions.append(link);
 const dialog=document.createElement('dialog');dialog.className='settings-page-dialog';dialog.setAttribute('aria-label',t('actionTitle'));
 root.before(page,dialog);dialog.append(root);
 let disposed=false,approved=false,lastFocus:HTMLElement|null=null;
 const editing=()=>!!document.activeElement?.closest('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"]');
 function open(){if(disposed)return;approved=false;if(!dialog.open)dialog.showModal();focus();}
 function close(){if(disposed)return;approved=true;if(dialog.open)dialog.close();openButton.focus();}
 const cancel=(event:Event)=>{event.preventDefault();if(!editing())void requestClose().catch(()=>{});};
 const rememberFocus=(event:FocusEvent)=>{if(event.target instanceof HTMLElement)lastFocus=event.target;};
 const closed=()=>{if(!approved&&!disposed&&!dialog.open){dialog.showModal();if(lastFocus?.isConnected)lastFocus.focus();if(!editing())void requestClose().catch(()=>{});}};
 dialog.addEventListener('focusin',rememberFocus);dialog.addEventListener('cancel',cancel);dialog.addEventListener('close',closed);openButton.onclick=open;open();
 return {open,close,isOpen:()=>dialog.open,dispose(){disposed=true;dialog.removeEventListener('focusin',rememberFocus);dialog.removeEventListener('cancel',cancel);dialog.removeEventListener('close',closed);dialog.before(root);dialog.remove();page.remove();}};
}
