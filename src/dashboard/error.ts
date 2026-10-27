import {t} from '../shared/i18n';
// 初期読み込みに失敗して編集画面を作れなくても、エラーから退出できる。
export function renderSettingsError(root:HTMLElement,error:unknown,close:()=>Promise<unknown>){
 const message=document.createElement('p'),button=document.createElement('button');
 message.setAttribute('role','alert');message.textContent=error instanceof Error?error.message:String(error);
 button.type='button';button.textContent=t('m_f6c244f98893');
 button.onclick=()=>{void close().catch(e=>{message.textContent=e instanceof Error?e.message:String(e);});};
 root.replaceChildren(message,button);button.focus();
}
