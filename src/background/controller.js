import {t} from "../shared/i18n";
import {defaults,validate,SETTINGS,LOCAL,CACHE,HISTORY} from '../shared/settings';
import {PROVIDERS,providerOf,profileOf,connection,connectionReady,connectionIdentity,connectionOrigin,requestBody,readDecision} from '../shared/ai.js';
import {aiError,httpError,failureState} from '../shared/ai-errors.js';
const TTL=7*86400000;
export class Controller{
 /** @param {any} store @param {any} transport @param {any} permissions */
 constructor(store,transport,permissions){this.store=store;this.transport=transport;this.permissions=permissions;this.generation=0;this.inflight=new Map();this.active=0;this.waiters=[];this.pages=new Map();this.writes=Promise.resolve();this.checkId=null;}
 serial(fn){const r=this.writes.then(fn,fn);this.writes=r.catch(()=>{});return r;}
 async settings(){return validate((await this.store.get(SETTINGS))[SETTINGS]||defaults);}
 async local(){return (await this.store.get(LOCAL))[LOCAL]||{provider:'jev',profiles:{}};}
 async state(admin=false){
  const settings=await this.settings(),local=await this.local(),configured=connectionReady(local);
  const permitted=configured&&await this.permissions.contains({origins:[connectionOrigin(providerOf(local))]}).catch(()=>false);
  const permissionError=configured&&!permitted?aiError(providerOf(local),'permission'):null;
  return {settings,revision:local.revision||0,...(admin?{local,history:(await this.store.get(HISTORY))[HISTORY]||[]}:{provider:local.provider||'jev',model:profileOf(local).model}),ai:{configured,permitted,verifying:!!this.checkId&&!!local.verifying,check:local.connectionCheck,ready:configured&&permitted,stopped:!!local.stopped,blockedUntil:local.blockedUntil||0,message:permissionError?.message||local.lastError||'',advice:permissionError?.advice||local.errorAdvice||''}};
 }
 async save(settings,local,expected,reason='editor-save'){return this.serial(async()=>{
  const next=validate(settings),current=await this.settings(),old=await this.local();
  // 停止状態やキャッシュ更新だけで、入力中の設定を競合扱いにしない。
  const signature=(s,l)=>JSON.stringify([s,providerOf(l),Object.keys(PROVIDERS).map(id=>profileOf(l,id))]);
  if(expected!==undefined){
   let before;try{before=JSON.parse(expected);}catch{throw Error(t("m_6ad0f535ea9a"));}
   if(signature(before.settings,before.local)!==signature(current,old))throw Error(t("m_847d71288424"));
  }
  const provider=providerOf(local),profiles={};
  for(const id of Object.keys(PROVIDERS)){const p=profileOf(local,id);profiles[id]={key:p.key.trim(),accountId:p.accountId.trim(),model:id==='clef'?p.model:profileOf({},id).model};}
  if(profiles.clef.accountId&&!/^[a-f\d]{32}$/i.test(profiles.clef.accountId))throw Error(t("m_919e67703e96"));
  if(!['clef','clef-flash'].includes(profiles.clef.model))throw Error(t("m_710248d6a662"));
  const conn={provider,profiles};
  const changed=connectionIdentity(conn)!==connectionIdentity(old)||profileOf(conn).key!==profileOf(old).key;
  const saved={...old,...conn,verifying:false,revision:(old.revision||0)+1,...(changed?{stopped:false,failures:0,blockedUntil:0,lastError:'',errorAdvice:'',verifying:false,connectionCheck:null}:{})};
  const history=(await this.store.get(HISTORY))[HISTORY]||[];
  if(JSON.stringify(current)!==JSON.stringify(next)){
   // 元の実装と同じく、連続入力は開始前の1履歴にまとめる。
   const now=Date.now(),last=history[0],elapsed=now-(last?.lastChanged??last?.time);
   if(reason==='editor-save'&&last?.reason===reason&&elapsed>=0&&elapsed<300000)history[0]={...last,lastChanged:now};
   else history.unshift({time:now,lastChanged:now,reason,settings:current});
  }
  this.generation++;this.pages.clear();await this.store.set({[SETTINGS]:next,[LOCAL]:saved,[HISTORY]:history.slice(0,10)});return this.state(true);
 });}
 async resume(){return this.serial(async()=>{this.generation++;this.pages.clear();const old=await this.local();await this.store.set({[LOCAL]:{...old,revision:(old.revision||0)+1,stopped:false,failures:0,blockedUntil:0,lastError:'',errorAdvice:''}});return this.state(true);});}
 async clear(){return this.serial(async()=>{this.generation++;this.pages.clear();const old=await this.local();await this.store.set({[CACHE]:{},[LOCAL]:{...old,revision:(old.revision||0)+1}});});}
 // Y!News Filter Plusと同じく、新しいキーは通常キャッシュと独立した最小判定で確認する。
 async verify(){
  const config=await this.settings(),local=await this.local();
  if(!connectionReady(local)||!await this.permissions.contains({origins:[connectionOrigin(providerOf(local))]}))return;
  const generation=this.generation,identity=connectionIdentity(local),key=profileOf(local).key,checkId=crypto.randomUUID();this.checkId=checkId;
  await this.serial(async()=>{if(generation!==this.generation)return;await this.store.set({[LOCAL]:{...await this.local(),verifying:true,stopped:false,failures:0,blockedUntil:0,lastError:'',errorAdvice:''}});});
  let check;
  try{const reply=await this.enqueue(()=>this.execute('connection-check',{id:'connection-check',text:t("m_c7ba55bf2b30")},{...config,aiConditions:[t("m_c7ba55bf2b30")]},local,'connection-check',generation,true),1);if(reply.stale)return;check={ok:!reply.skipped,time:Date.now(),usage:reply.usage,provider:reply.provider,model:reply.model};}
  catch{check={ok:false,time:Date.now()};}
  finally{if(this.checkId===checkId)this.checkId=null;await this.serial(async()=>{const latest=await this.local();if(generation!==this.generation||connectionIdentity(latest)!==identity||profileOf(latest).key!==key)return;await this.store.set({[LOCAL]:{...latest,verifying:false,connectionCheck:check||null}});});}
 }
 async invalidate(){return this.serial(async()=>{this.generation++;this.pages.clear();});}
 async cacheRead(key){const entry=((await this.store.get(CACHE))[CACHE]||{})[key];return entry&&entry.time<=Date.now()+60000&&Date.now()-entry.time<(entry.skipped?600000:TTL)?entry:null;}
 async cacheWrite(key,entry,generation){return this.serial(async()=>{
  if(generation!==this.generation)return;
  const all=(await this.store.get(CACHE))[CACHE]||{};all[key]=entry;
  const out={};let size=0;
  for(const [k,v] of Object.entries(all).filter(([,v])=>v&&Date.now()-v.time<(v.skipped?600000:TTL)).sort((a,b)=>b[1].time-a[1].time).slice(0,2000)){
   size+=k.length+JSON.stringify(v).length;if(size>2000000)break;out[k]=v;
  }
  await this.store.set({[CACHE]:out});
 });}
 async hash(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
 async decide(post,page){
  if(!post||typeof post.text!=='string'||!post.text.trim()||post.text.length>64000||typeof post.id!=='string'||post.id.length>300)throw aiError('','format');
  const config=await this.settings(),local=await this.local();
  if(!config.enabled||!config.aiEnabled||!config.aiConditions.length)return {inactive:true};
  if(!connectionReady(local))throw aiError(local.provider,'credentials');
  if(this.checkId&&local.verifying||local.stopped||Date.now()<(local.blockedUntil||0))return {paused:true};
  const key=await this.hash(JSON.stringify([1,connectionIdentity(local),post.id,post.text,config.aiConditions]));
  const cached=await this.cacheRead(key);if(cached&&(cached.skipped||Array.isArray(cached.scores)&&cached.scores.length===config.aiConditions.length&&cached.scores.every(x=>typeof x==='number'&&Number.isFinite(x)&&x>=0&&x<=1)))return {...cached,cached:true,attempted:false};
  if(this.inflight.has(key))return this.inflight.get(key).then(value=>({...value,shared:true,attempted:false}));
  const generation=this.generation;
  const run=this.enqueue(()=>this.execute(key,post,config,local,page,generation),config.aiConcurrency).finally(()=>this.inflight.delete(key));
  this.inflight.set(key,run);return run;
 }
 enqueue(action,limit){return new Promise((resolve,reject)=>{this.waiters.push({action,limit,resolve,reject});this.drain();});}
 drain(){while(this.waiters.length&&this.active<this.waiters[0].limit){const job=this.waiters.shift();this.active++;Promise.resolve().then(job.action).then(job.resolve,job.reject).finally(()=>{this.active--;this.drain();});}}
 async execute(key,post,config,local,page,generation,verifying=false){
  const provider=providerOf(local),started=Date.now();
  const stale=()=>generation!==this.generation;
  if(stale())return {stale:true};
  const current=await this.local();if(!verifying&&this.checkId&&current.verifying||current.stopped||Date.now()<(current.blockedUntil||0))return {paused:true};
  
  if(!verifying){const count=this.pages.get(page)||0;if(count>=config.aiRequestLimit)return {limited:true};this.pages.set(page,count+1);if(this.pages.size>200)this.pages.delete(this.pages.keys().next().value);}
  const c=connection(local),conditions=config.aiConditions;
  const questions=Object.fromEntries(conditions.map((condition,i)=>['q'+i,{type:'noul',instructions:t("m_f08dedb7fdef",[condition]),criteria:{true:t("m_e95ab486df20"),false:t("m_64dcac62247a")}}]));
  try{
   if(!await this.permissions.contains({origins:[connectionOrigin(provider)]}))throw aiError(provider,'permission');
   const r=await this.transport(c.url,{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+c.key},body:JSON.stringify(requestBody(c,post.text,questions))});
   if(stale())return {stale:true};
   if(r.status!==200){const error=httpError(provider,r.status,r.text);error.retry=r.retry;throw error;}
   let parsed;try{parsed=JSON.parse(r.text);}catch{throw aiError(provider,'format');}
   const result=readDecision(c,parsed,conditions.map((_,i)=>i)),entry={time:Date.now(),scores:result.scores,provider:c.provider,model:c.model};
   if(!verifying)await this.cacheWrite(key,entry,generation);
   await this.serial(async()=>{if(stale())return;const latest=await this.local();if(!latest.stopped&&!latest.blockedUntil) return;if(!latest.stopped&&Date.now()>=(latest.blockedUntil||0))await this.store.set({[LOCAL]:{...latest,failures:0,blockedUntil:0,lastError:'',errorAdvice:''}});});
   return stale()?{stale:true}:{...entry,cached:false,attempted:true,usage:result.usage,elapsedMs:Date.now()-started};
  }catch(e){
   if(stale())return {stale:true};
   const error=e?.kind?e:aiError(provider,'network');
   if(error.scope==='article'||error.kind==='refusal'){
    const entry={time:Date.now(),skipped:error.kind,provider:c.provider,model:c.model};if(!verifying)await this.cacheWrite(key,entry,generation);return {...entry,attempted:true,elapsedMs:Date.now()-started};
   }
   await this.serial(async()=>{if(stale())return;const latest=await this.local();if(connectionIdentity(latest)!==connectionIdentity(local))return;await this.store.set({[LOCAL]:failureState(latest,error)});});
   throw Object.assign(error,{attempted:error.kind!=='permission',elapsedMs:Date.now()-started});
  }
 }
}
