import en from '../../public/_locales/en/messages.json';
import ja from '../../public/_locales/ja/messages.json';
// RakuFillと同じChrome標準i18n。無効化後は同梱リソースと最後のUI言語で表示を継続する。
let lastLanguage='',chromeUnavailable=false;
export function language():string{
 if(!chromeUnavailable){
  try{if(typeof chrome!=='undefined'&&chrome.i18n?.getUILanguage){lastLanguage=chrome.i18n.getUILanguage();return lastLanguage;}}
  catch{chromeUnavailable=true;}
 }
 return lastLanguage||(typeof document!=='undefined'&&document.documentElement.lang)||'en';
}
export function t(key:string,substitutions:unknown[]|string=[]):string{
 const values=(Array.isArray(substitutions)?substitutions:[substitutions]).map(String),locale=language();
 if(!chromeUnavailable){
  try{if(typeof chrome!=='undefined'&&chrome.i18n?.getMessage){const message=chrome.i18n.getMessage(key,values);if(message)return message;}}
  catch{chromeUnavailable=true;}
 }
 const catalog=(locale.startsWith('ja')?ja:en) as Record<string,{message:string;placeholders?:Record<string,{content:string}>}>;
 const entry=catalog[key];if(!entry)throw Error('Missing translation: '+key);
 return entry.message.replace(/\$([A-Za-z_][A-Za-z_0-9]*)\$/g,(_,name:string)=>{const placeholder=entry.placeholders?.[name.toLowerCase()]||entry.placeholders?.[name];if(!placeholder)return '';const n=Number(placeholder.content.slice(1));return values[n-1]??'';});
}

// リロードでAPIが無効になる前にUI言語を確保する。
language();
