import {isDisconnectedError} from '../shared/connection';
import {reportRecords} from '../shared/report';
import {createOverlay} from './overlay';
import {t} from "../shared/i18n";
import {defaults,normalize,parseRows,shouldHide} from '../shared/settings';
import {extractPost,postContainer,ARTICLE} from './posts';
const HIDE='data-xpf-hidden';
const freshStats=()=>({requests:0,success:0,failed:0,refused:0,input:0,output:0,unknown:0,lastError:''});
/** @param {any} api */
export async function start(api){
 let state=await api.call('GET'),settings=state.settings||{...defaults},epoch=0,active=0,disposed=false,connectionLost=false,scanTimer=0,stopListening=()=>{},stopDisconnectListening=()=>{},paused=false,page=crypto.randomUUID(),url=location.href,view=viewKey(),checks=0,limited=false,stats=freshStats(),rules=[];
 const processingTraces=new Map(),displayTraces=new Map();
 const records=new Map(),observed=new Map(),released=new Set(),inflight=new Map(),results=new Map(),normalizedPosts=new Map(),keywordDecisions=new Map();
 let keywordSignature='',debugEnabled=state.debugEnabled===true;
 const style=document.createElement('style');style.textContent=`[${HIDE}]{display:none!important}`;document.head.append(style);
 const overlay=createOverlay({pause:()=>{pause();},open:()=>{void api.call('OPEN').catch(showConnectionError);},release:reason=>{if(connectionLost||disposed)return;released.has(reason)?released.delete(reason):released.add(reason);scan();}}),root=overlay.root,host=overlay.host;
 function pause(){if(connectionLost||disposed)return snapshot();paused=!paused;scan();return snapshot();}
 function showConnectionError(){
  if(disposed||connectionLost)return;
  connectionLost=true;epoch++;observer.disconnect();clearTimeout(scanTimer);clearInterval(timer);window.removeEventListener('scroll',onScroll);window.removeEventListener('focus',onFocus);stopListening();stopDisconnectListening();
  let count=0;const counts=new Map();for(const record of records.values())if(record.article.isConnected&&record.container?.hasAttribute(HIDE)){count++;for(const reason of record.reasons||[])if(!released.has(reason))counts.set(reason,(counts.get(reason)||0)+1);}
  overlay.update({count,enabled:settings.enabled,paused,show:true,running:false,showProgress:false,progress:'',error:'',words:[...counts],released,reloadRequired:true});
 }
 function connected(){if(connectionLost||disposed)return false;if(api.isConnected?.()===false){showConnectionError();return false;}return true;}

 function trace(store,key,message,limit){
  const previous=store.get(key),time=new Date().toISOString(),events=[...(previous?.events||[]),`${time} · ${String(message).slice(0,2000)}`].slice(-limit);
  store.delete(key);store.set(key,{time,events});if(store.size>500)store.delete(store.keys().next().value);
 }
 function traceProcessing(key,message){trace(processingTraces,key,message,20);}
 function traceDisplay(post,message){trace(displayTraces,post.id==='text'?post.identity:post.id,message,40);}
 function viewKey(){const selected=document.querySelector('main [role="tablist"] [role="tab"][aria-selected="true"]');return location.href+'|'+(selected?.getAttribute('href')||selected?.textContent||'');}
 function identityKey(post){return JSON.stringify([state.provider,post.id,post.text,settings.aiConditions]);}
 function aiBypass(){return !settings.enabled?'filter-off':paused?'paused':!settings.aiEnabled?'off':!settings.aiConditions.length?'no-conditions':null;}
 function usable(){return !aiBypass()&&state.ai.ready&&!state.ai.verifying&&!state.ai.stopped&&Date.now()>=(state.ai.blockedUntil||0);}
 function hide(record,reasons){
  const container=postContainer(record.article),previous=record.container?.hasAttribute(HIDE);
  if(record.container&&record.container!==container)record.container.removeAttribute(HIDE);
  record.container=container;record.reasons=reasons;
  const hidden=settings.enabled&&!paused&&reasons.some(r=>!released.has(r));
  if(hidden)container.setAttribute(HIDE,'');else container.removeAttribute(HIDE);
  const signature=JSON.stringify([hidden,reasons.filter(r=>!released.has(r)),paused,settings.enabled]);
  if(record.displaySignature!==signature||previous!==hidden){
   traceDisplay(record.post,hidden?t('traceHidden',[reasons.filter(r=>!released.has(r)).join(', ')]):t('traceVisible',[!settings.enabled?t('filterOff'):paused?t('temporarilyShowing'):t('filterVisible')]));record.displaySignature=signature;
  }
 }
 function paint(record){
  // 正規化は本文・照合設定ごとに高々2回。除外率は同じポストに再適用しない。
  let normalized=normalizedPosts.get(record.post.identity);
  if(!normalized){normalized={};normalizedPosts.set(record.post.identity,normalized);if(normalizedPosts.size>500)normalizedPosts.delete(normalizedPosts.keys().next().value);}
  const rule=rules.find(r=>{
   if(released.has('keyword: '+r.word))return false;
   const key=String(r.sensitive);if(normalized[key]===undefined)normalized[key]=normalize(record.post.text,settings,r.sensitive);
   return normalized[key].includes(r.needle);
  });
  let keywordHidden=false;
  if(rule){let decisions=keywordDecisions.get(record.post.identity);if(!decisions){decisions=new Map();keywordDecisions.set(record.post.identity,decisions);if(keywordDecisions.size>2000)keywordDecisions.delete(keywordDecisions.keys().next().value);}if(!decisions.has(rule))decisions.set(rule,shouldHide(rule,settings));keywordHidden=decisions.get(rule);}
  record.keywordReasons=keywordHidden?[rule.word]:[];const reasons=record.keywordReasons.map(w=>'keyword: '+w);
  if(!reasons.length&&settings.aiEnabled&&state.ai.ready&&!state.ai.verifying&&!state.ai.stopped){const entry=results.get(identityKey(record.post));if(entry?.scores)entry.scores.forEach((score,i)=>{if(score>=settings.aiThreshold)reasons.push('AI: '+settings.aiConditions[i]);});}
  hide(record,reasons);
 }
 function systemError(){if(state.ai.verifying)return '';return settings.aiEnabled?(!state.ai.ready?(state.ai.message||t("m_a5a0977a526d")):state.ai.stopped?state.ai.message:Date.now()<(state.ai.blockedUntil||0)?state.ai.message:''):'';}
 function pendingReason(record,key,entry){
  if(state.ai.verifying)return t('decisionConnectionCheck');
  if(inflight.has(key))return t('m_4d4581514a7a');
  const error=systemError();if(error)return error;
  if(entry?.limited||limited)return t('m_6825ae3ac081');
  if(!record.article.isConnected)return t('decisionWaitingViewport');
  const rect=record.article.getBoundingClientRect();if(rect.bottom< -400||rect.top>innerHeight+800)return t('decisionWaitingViewport');
  if(active>=settings.aiConcurrency)return t('decisionWaitingSlot');
  return t('decisionNotSubmitted');
 }
 function snapshot(includeRows=true){
  const bypass=aiBypass(),bypassMessage=bypass==='filter-off'?t('m_12161073047e'):bypass==='paused'?t('m_f67d4cbf9d89'):bypass==='off'?t('m_4603c00396af'):bypass==='no-conditions'?t('m_211a77b7c060'):'';
  const live=[...records.values()].filter(r=>r.article.isConnected),hiddenWords=new Set();
  const summary={target:live.length,hidden:0,keyword:0,aiHidden:0,cached:0,pending:0,prior:0,fresh:0,uniquePrior:0,uniqueFresh:0};
  const prior=new Set(),fresh=new Set(),positive=new Map(),negative=new Map();
  for(const r of live){
   const key=identityKey(r.post),entry=results.get(key),hidden=r.container?.hasAttribute(HIDE),word=!!r.keywordReasons?.length;
   if(hidden){summary.hidden++;for(const reason of r.reasons)if(!released.has(reason))hiddenWords.add(reason.startsWith('keyword: ')?reason.slice(9):reason);if(word)summary.keyword++;else summary.aiHidden++;}
   if(entry?.scores){summary.cached++;if(entry.cached){summary.prior++;prior.add(key);}else{summary.fresh++;fresh.add(key);}entry.scores.forEach((score,i)=>{const map=score>=settings.aiThreshold?positive:negative,condition=settings.aiConditions[i];map.set(condition,(map.get(condition)||0)+1);});}
   else if(!word&&!entry&&!bypass)summary.pending++;
  }
  summary.uniquePrior=prior.size;summary.uniqueFresh=fresh.size;
  /** @type {import('../shared/report').DecisionRow[]} */
  const rows=[];
  /** @type {import('../shared/report').Diagnostics} */
  const diagnostics={};let detailCount=0;
  if(includeRows)for(const r of observed.values()){
   const decisionKey=identityKey(r.post),entry=results.get(decisionKey),trace=processingTraces.get(decisionKey),word=r.keywordReasons||[],conditions=word.length?word:settings.aiConditions.length?settings.aiConditions:[''];
   const detailsId=String(detailCount++),inputKnown=!!entry&&(entry.cached||entry.shared||entry.attempted===true)&&!word.length;
   diagnostics[detailsId]={processingError:!!(!bypass&&!word.length&&entry?.skipped&&entry.skipped!=='refusal'),lastProcessedAt:trace?.time||null,processingLog:trace?.events||[],displayLog:displayTraces.get(r.post.id==='text'?r.post.identity:r.post.id)?.events||[],sentText:inputKnown?r.post.text:null,...(!inputKnown&&r.post.text.length>1000?{postText:r.post.text}:{}),inputOrigin:!inputKnown?'none':entry.cached?'cache':entry.shared?'shared':'api'};
   for(const [i,condition]of conditions.entries()){
    let reason=word.length?t("m_e0b14ab0f48f"):bypass?bypassMessage:entry?.skipped==='refusal'?t("m_dbb084c9625c"):entry?.skipped?(entry.errorMessage||t("m_edd92fd89aaf")+entry.skipped):entry?.scores?t("m_f42765775fd4"):pendingReason(r,decisionKey,entry);
    const score=word.length?null:entry?.scores?.[i]??null;
    const hidden=settings.enabled&&!paused&&(word.length?word.some(w=>!released.has('keyword: '+w)):settings.aiEnabled&&state.ai.ready&&!state.ai.verifying&&!state.ai.stopped&&entry?.scores?.some((s,j)=>s>=settings.aiThreshold&&!released.has('AI: '+settings.aiConditions[j])));
    if(word.length&&!hidden)reason=t('keywordMatchedVisible');
    const decisive=hidden&&!word.length&&score!==null&&score>=settings.aiThreshold&&!released.has('AI: '+condition);
    rows.push({detailsId,providerPlanned:!word.length&&!bypass&&!entry?.provider,aiEnabled:usable(),temporarilyReleased:released.has(word.length?'keyword: '+condition:'AI: '+condition),postId:r.post.id,author:r.post.author,text:r.post.text.slice(0,1000),condition,provider:word.length?'':entry?.provider||(!bypass?state.provider:'')||'',model:word.length?'':entry?.model||(!bypass?state.model:'')||'',score,threshold:word.length||bypass&&!entry?.scores?null:settings.aiThreshold,aiUsage:bypass||'not-fetched',source:word.length?t("m_d9acb15aeab3"):entry?.cached?t("m_b7612a6cdb0a"):entry?.shared?t("detailSharedSource"):entry?.scores||entry?.skipped?t("m_11d11a2b6c64"):bypass?t('aiNotApplicable'):t("m_e7954a2f3ace"),display:hidden?t("m_8389c10f44c0"):t("m_17efc6654ed2"),reason,keyword:!!word.length,kind:word.length?(hidden?'keyword-excluded-row':'other-row'):bypass?'other-row':entry?.skipped?'error-row':!word.length&&!entry?.scores?'pending-row':decisive?'excluded-row':'other-row',elapsedMs:word.length?null:entry?.elapsedMs??null});
    if(rows.length>=2000)break;
   }if(rows.length>=2000)break;
  }
  const message=systemError()||(!settings.enabled?t("m_12161073047e"):paused?t("m_f67d4cbf9d89"):!settings.aiEnabled?t("m_34903a0a9845"):!settings.aiConditions.length?t("m_211a77b7c060"):!summary.target?t("m_a8aa28cec8dd"):limited?t("m_b2826f37e679"):active?t("m_c2c7eedd98ad",[active]):summary.pending?t("m_aceb4c0ecaf7"):t("m_4dfaf77eacf0"));
  return {url,title:document.title,page,paused,debugEnabled,hiddenWords:[...hiddenWords],summary,stats:{...stats},active,message,error:systemError(),positive:[...positive],negative:[...negative],rows,diagnostics};
 }
 let lastLog='',lastBadge='';
 function setDebug(enabled){debugEnabled=enabled===true;lastLog='';render();return snapshot(false);}
 function render(){
  if(!connected())return;
  let hidden=0;const counts=new Map();
  for(const r of records.values()){if(!r.article.isConnected||!r.container?.hasAttribute(HIDE))continue;hidden++;for(const reason of r.reasons||[])if(!released.has(reason))counts.set(reason,(counts.get(reason)||0)+1);}
  for(const reason of released)if(!counts.has(reason))counts.set(reason,0);
  overlay.update({count:hidden,enabled:settings.enabled,paused,show:settings.showPageChip!==false,running:active>0,showProgress:settings.aiShowProgress,progress:t('chipProgress',[stats.success+stats.failed+stats.refused,checks]),error:systemError(),words:[...counts],released});
  const badgeState=JSON.stringify([hidden,systemError()]);if(lastBadge!==badgeState){lastBadge=badgeState;void api.call('BADGE',{count:hidden,error:systemError()}).catch(error=>{lastBadge='';if(isDisconnectedError(error)||api.isConnected?.()===false)showConnectionError();});}
  if(debugEnabled){const report=snapshot(),key=JSON.stringify([report.rows,report.diagnostics]);if(key!==lastLog){lastLog=key;console.table(reportRecords(report.rows,report.diagnostics));}}
 }
 function schedule(){if(!connected()||scanTimer)return;scanTimer=setTimeout(()=>{scanTimer=0;scan();},120);}
 function scan(){
  if(!connected())return;
  const signature=JSON.stringify([settings.rows,settings.ignoreCase,settings.normalizeText,settings.ignoreSeparators,settings.legacyRate]);
  if(keywordSignature!==signature){keywordSignature=signature;rules=parseRows(settings.rows,settings);normalizedPosts.clear();keywordDecisions.clear();}
  if(view!==viewKey()){view=viewKey();url=location.href;epoch++;results.clear();page=crypto.randomUUID();checks=0;limited=false;stats=freshStats();observed.clear();processingTraces.clear();displayTraces.clear();released.clear();paused=false;for(const rule of rules)rule.count=0;normalizedPosts.clear();keywordDecisions.clear();}
  for(const [article,r]of records)if(!article.isConnected){traceDisplay(r.post,t('traceRemoved'));r.container?.removeAttribute(HIDE);records.delete(article);}
  for(const article of document.querySelectorAll(ARTICLE)){
   const post=extractPost(article),prior=records.get(article);
   if(!post){if(prior)traceDisplay(prior.post,t('traceRemoved'));prior?.container?.removeAttribute(HIDE);records.delete(article);continue;}
   if(!prior||prior.post.identity!==post.identity){if(prior){traceDisplay(prior.post,t('traceReused'));traceDisplay(post,t('traceReused'));}prior?.container?.removeAttribute(HIDE);records.set(article,{article,post,reasons:[],container:null});}
   const record=records.get(article);record.post=post;paint(record);observed.set(post.identity,record);
  }
  while(observed.size>500)observed.delete(observed.keys().next().value);
  render();void pump();
 }
 function countReply(reply){
  if(reply.cached||reply.shared||reply.attempted===false)return;
  stats.requests++;if(reply.skipped==='refusal')stats.refused++;else if(reply.skipped)stats.failed++;else stats.success++;
  const usage=reply.usage,input=usage?.input_tokens??usage?.prompt_tokens,output=usage?.output_tokens??usage?.completion_tokens;
  if(Number.isFinite(input)&&Number.isFinite(output)&&input>=0&&output>=0){stats.input+=input;stats.output+=output;}else stats.unknown++;
 }
 async function pump(){
  if(!connected()||paused||!usable())return;
  for(const r of records.values()){
   if(active>=settings.aiConcurrency)return;
   if(!r.article.isConnected||r.keywordReasons?.length)continue;
   const key=identityKey(r.post);if(results.has(key)||inflight.has(key))continue;
   const rect=r.article.getBoundingClientRect();if(rect.bottom< -400||rect.top>innerHeight+800)continue;
   const generation=epoch,requestPage=page;active++;checks++;inflight.set(key,true);traceProcessing(key,t('traceChecking'));render();
   void api.call('DECIDE',{post:{id:r.post.id,text:r.post.text},page}).then(reply=>{
    if(!connected()||generation!==epoch||requestPage!==page||reply.stale)return;
    if(reply.paused){traceProcessing(key,t('tracePaused'));void refresh();return;}if(reply.limited){traceProcessing(key,t('traceLimit'));limited=true;results.set(key,{limited:true});return;}if(reply.inactive){traceProcessing(key,t('traceInactive'));return;}
    traceProcessing(key,reply.cached?t('traceCache'):reply.shared?t('traceShared'):reply.skipped?t('traceSkipped',[reply.errorMessage||reply.skipped]):t('traceCompleted',[JSON.stringify(reply.scores||[])]));
    countReply(reply);if(reply.skipped&&reply.skipped!=='refusal')stats.lastError=t("m_c42c5260223f")+reply.skipped+'）。';results.set(key,reply);
   }).catch(error=>{if(generation!==epoch||disposed||connectionLost||requestPage!==page)return;if(isDisconnectedError(error)||api.isConnected?.()===false){showConnectionError();return;}if(error.attempted!==false){stats.requests++;stats.failed++;stats.unknown++;}stats.lastError=error.message;traceProcessing(key,t('traceFailed',[error.message]));
    results.set(key,{skipped:error.kind||'error',errorMessage:error.message,attempted:error.attempted===true,provider:error.attempted?state.provider:'',model:error.attempted?state.model:'',elapsedMs:error.elapsedMs});if(error.scope!=='article'){state.ai.stopped=true;state.ai.message=error.message;void refresh();}
   }).finally(()=>{active--;inflight.delete(key);if(results.size>2000)results.delete(results.keys().next().value);if(!disposed&&!connectionLost&&generation===epoch)scan();else if(!disposed&&!connectionLost)schedule();});
  }
 }
 async function refresh(){if(!connected())return;try{const next=await api.call('GET');if(disposed||connectionLost)return;
  if(JSON.stringify([next.settings,next.provider,next.revision])!==JSON.stringify([settings,state.provider,state.revision])){epoch++;results.clear();processingTraces.clear();checks=0;limited=false;released.clear();}
  const wasPaused=state.ai.stopped||Date.now()<(state.ai.blockedUntil||0),nowPaused=next.ai.stopped||Date.now()<(next.ai.blockedUntil||0);
  if(wasPaused&&!nowPaused){epoch++;results.clear();processingTraces.clear();checks=0;limited=false;}
  if(debugEnabled!==(next.debugEnabled===true))lastLog='';debugEnabled=next.debugEnabled===true;state=next;settings=next.settings;scan();
 }catch{showConnectionError();}}
 const observer=new MutationObserver(changes=>{if(changes.some(r=>!host.contains(r.target)&&r.target!==style))schedule();});
 observer.observe(document.body,{childList:true,subtree:true,characterData:true,attributes:true,attributeFilter:['href','data-testid','aria-selected']});
 const onScroll=()=>schedule(),onFocus=()=>void refresh();window.addEventListener('scroll',onScroll,{passive:true});window.addEventListener('focus',onFocus);
 const timer=setInterval(()=>{void refresh();},5000);
 stopListening=api.listen?.(m=>m?.type==='SNAPSHOT'?snapshot(m.details!==false):m?.type==='PAUSE'?pause():m?.type==='DEBUG_CHANGED'?setDebug(m.enabled):m?.type==='SETTINGS_VISIBILITY'?overlay.setSettingsOpen(m.visible):void refresh())||(()=>{});
 stopDisconnectListening=api.onDisconnected?.(showConnectionError)||(()=>{});
 scan();
 return {scan,refresh,snapshot,pause,root,dispose(){disposed=true;epoch++;observer.disconnect();clearTimeout(scanTimer);clearInterval(timer);window.removeEventListener('scroll',onScroll);window.removeEventListener('focus',onFocus);stopListening();stopDisconnectListening();for(const r of records.values())r.container?.removeAttribute(HIDE);processingTraces.clear();displayTraces.clear();overlay.dispose();style.remove();}};
}
