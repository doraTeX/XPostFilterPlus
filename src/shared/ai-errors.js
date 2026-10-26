import {t} from "./i18n";
import {PROVIDERS} from './ai.js';

// 接続先が返すデータを直接表示せず、本文や認証情報の混入を避ける。
export function aiError(provider,kind,{status=0,code='',phase=t("m_15c58df57646")}={}){
 const name=PROVIDERS[provider]||'AI';
 let message='',advice='',stop=false,focusKey=false;
 if(kind==='http'){
  message=t("m_fa1c61c199bc",[status,name,phase]);
  if(provider==='clef'&&code==='3036'){
   stop=true;advice=t("m_77c75815cd20");
  }else if(provider==='clef'&&['5007','3003'].includes(code)){
   stop=true;advice=t("m_5a823009f382");
  }else if([401,403].includes(status)){
   stop=true;focusKey=true;
   advice=provider==='clef'?t("m_ff7499ad60ba"):t("m_89e7dc07969d",[name]);
  }else if(status===402||(status===429&&['insufficient_quota','credit_balance_exhausted','organization_spend_limit_exceeded','project_spend_limit_exceeded','organization_usage_limit_exceeded'].includes(code))){
   stop=true;advice=t("m_30cef50a6c4e",[name]);
  }else if(status===404){
   stop=true;advice=provider==='clef'?t("m_844d15a8c6f8"):t("m_f34f1ebfd45b",[name]);
  }else if([400,413,422].includes(status)){
   stop=true;advice=t("m_bf3fb8b488b1");
  }else if(status===429){advice=t("m_bf25b413a1a1");
  }else if(status>=500||[408,425].includes(status)){
   advice=t("m_1cebff77df40",[name]);
  }else{stop=true;advice=t("m_0e885ac907b5");}
 }else if(kind==='storage'){
  stop=true;message=t("m_40c035aeba18");advice=t("m_7f1a4428ffd7");
 }else if(kind==='credentials'){
  stop=true;focusKey=true;message=t("m_67cf2e432dd0",[name]);advice=t("m_db38ad33a1ff");
 }else if(kind==='permission'){
  stop=true;message=t("m_8da032107dcb",[name]);advice=t("m_dda80649b966");
 }else if(kind==='timeout'||kind==='network'){
  message=t("m_3e36e7908c45",[name,phase,kind==='timeout'?t("m_b6dc765c06f3"):t("m_86b213101271")]);
  advice=t("m_db16b7902815",[name]);
 }else if(kind==='refusal'){
  message=t("m_53195910a849",[name]);advice=t("m_672df82843a3");
 }else if(kind==='provider'){
  stop=true;message=t("m_41bbcf63a7e7",[name,phase]);advice=t("m_f8fdfd948479");
 }else if(kind==='changed'){
  message=t("m_6172b864d560");advice=t("m_e56b0636f191");
 }else if(kind==='size'){
  stop=true;message=t("m_4c69892f5a6b",[name]);advice=t("m_a8b4dc7f0a65");
 }else{
  stop=true;kind='format';message=t("m_6d0c348b0886",[name,phase]);advice=t("m_f46d0284b7ec");
 }
 const scope=provider==='clef'&&['3036','5007','3003'].includes(code)?'global':['refusal','format','size','timeout'].includes(kind)||(kind==='http'&&[400,408,413,422].includes(status))?'article':'global';
 if(scope==='article')stop=false;
 return Object.assign(Error(message),{provider,kind,status,stop,advice,focusKey,scope});
}
export function httpError(provider,status,responseText,phase=t("m_15c58df57646")){
 let code='';try{const data=JSON.parse(responseText);const value=data?.error?.code??data?.errors?.[0]?.code??data?.code;if(typeof value==='string'||typeof value==='number')code=String(value);}catch{}
 return aiError(provider,'http',{status,code,phase});
}
export function failureState(old,error,now=Date.now()){
 // 並行リクエストの結果で、重大エラーとその対処案内を取り消さない。
 if(error.scope==='article'||error.kind==='refusal'||old.stopped)return old;
 const failures=(old.failures||0)+1,seconds=Number(error.retry);
 const retry=error.retry&&Number.isFinite(seconds)?Math.max(0,seconds*1000):Math.max(0,Date.parse(error.retry||'')-now)||0;
 return {...old,failures,stopped:!!error.stop||failures>=5,blockedUntil:now+Math.max(60000*Math.min(30,2**failures),retry),lastError:error.message,lastErrorAt:new Date(now).toISOString(),errorKind:error.kind||'',errorProvider:error.provider||old.provider||'jev',errorAdvice:error.advice||'',errorFocusKey:!!error.focusKey};
}
