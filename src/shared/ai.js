import {t} from "./i18n";
import {aiError} from './ai-errors.js';
// 接続設定はこのブラウザ内に保存し、キーを接続先ごとに分離する。
export const AI_LOCAL='xpf_local_v1';
export const PROVIDERS={jev:'Jev',openai:'OpenAI Decisions',clef:'Cloudflare Clef'};
export function providerOf(local={}){const id=local.provider||'jev';if(!Object.hasOwn(PROVIDERS,id))throw Error(t("m_a8cd8392d278"));return id;}
export function profileOf(local={},id=providerOf(local)){
 const saved=local.profiles?.[id]||{};
 return {key:id==='jev'?(saved.key??local.key??''):(saved.key||''),accountId:saved.accountId||'',model:saved.model||(id==='jev'?'jev-1.13.0':id==='openai'?'gpt-6-luna':id==='clef'?'clef':'')};
}
export function connection(local={}){
 const provider=providerOf(local),p=profileOf(local,provider);
 let url;
 if(provider==='jev')url='https://api.typesafe.ai/v1/systemone';
 if(provider==='openai')url='https://api.openai.com/v1/decisions';
 if(provider==='clef'){
  if(!/^[a-f\d]{32}$/i.test(p.accountId))throw Error(t("m_d04b8b857314"));
  if(!['clef','clef-flash'].includes(p.model))throw Error(t("m_7112f0b36b9e"));
  url=`https://api.cloudflare.com/client/v4/accounts/${p.accountId}/ai/run/@cf/cloudflare/${p.model}`;
 }
 return {provider,...p,url,key:p.key};
}
export function connectionReady(local){try{const c=connection(local);return !!c.key.trim();}catch{return false;}}
export function connectionIdentity(local){try{const c=connection(local);return JSON.stringify([c.provider,c.url,c.model]);}catch{const p=local.profiles?.[local.provider]||{};return JSON.stringify([local.provider,p.baseUrl,p.model,p.accountId]);}}
export function connectionOrigin(id){
 const url=({jev:'https://api.typesafe.ai',clef:'https://api.cloudflare.com',openai:'https://api.openai.com'})[id];
 if(!url)throw Error(t("m_a8cd8392d278"));
 // Chromeの接続許可はホスト単位で要求する。
 return new URL(url).protocol+'//'+new URL(url).hostname+'/*';
}
export function requestBody(c,content,questions){
 if(c.provider==='openai')return {model:c.model,input:content,questions:Object.entries(questions).map(([name,q])=>({name,type:'predicate',instructions:q.instructions+t("m_4585dde9d035")+q.criteria.true+t("m_edd7160a2559")+q.criteria.false}))};
 return {model:c.model,state:{post_text:content},questions};
}
export function readDecision(c,raw,targets){
 let data=raw;
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw aiError(c.provider,'format');
 if(c.provider==='clef'&&Object.hasOwn(raw,'success')){if(raw.success!==true)throw aiError(c.provider,'provider');data=raw.result;}
 if(!data||typeof data!=='object')throw aiError(c.provider,'format');
 const scores=targets.map(i=>{
  if(c.provider!=='openai'){
   const answer=data.answers?.['q'+i];
   if(answer?.type==='refusal')throw aiError(c.provider,'refusal');
   return answer?.noul;
  }
  const matches=Array.isArray(data.answers)?data.answers.filter(a=>a?.name==='q'+i):[];
  if(matches.length!==1)throw aiError(c.provider,'format');
  if(matches[0].type==='refusal')throw aiError(c.provider,'refusal');
  if(matches[0].type!=='predicate')throw aiError(c.provider,'format');
  return matches[0].probability;
 });
 if(!scores.every(v=>typeof v==='number'&&Number.isFinite(v)&&v>=0&&v<=1))throw aiError(c.provider,'format');
 return {scores,usage:data.usage};
}

