import {t} from "../shared/i18n";
import {SETTINGS,HISTORY,parseDoc,newDoc,heads,encodeDoc,decodeRemote,assertQuota,type Doc,type Settings} from '../shared/sync';
import {validate,defaults} from '../shared/settings';
const STATE='xpf_sync_state';
export const SYNC_ALARM='xpf-sync';
type State={device:string;enabled:boolean;doc:Doc|null;pending:boolean;conflicts:Doc[];message:string};
export class SyncStore{
 private chain=Promise.resolve();
 constructor(private transaction:<T>(fn:()=>Promise<T>)=>Promise<T>=fn=>fn()){}
 queue<T>(fn:()=>Promise<T>):Promise<T>{const run=()=>this.transaction(fn),result=this.chain.then(run,run);this.chain=result.then(()=>{},()=>{});return result;}
 async state():Promise<State>{
  const s:State=(await chrome.storage.local.get(STATE))[STATE]??{device:crypto.randomUUID(),enabled:false,doc:null,pending:false,conflicts:[],message:t("m_46c87f5d6b04")};
  // ローカルの同期履歴にも、新しい設定項目の既定値を補う。
  if(s.doc)s.doc=parseDoc(JSON.stringify(s.doc));
  s.conflicts=s.conflicts.map(d=>parseDoc(JSON.stringify(d)));
  return s;
 }
 async remember(s:State){await chrome.storage.local.set({[STATE]:s});}
 async history(next:Settings,reason:string){
  const data=await chrome.storage.local.get([SETTINGS,HISTORY]),old=data[SETTINGS];
  if(!old||JSON.stringify(old)===JSON.stringify(next))return;
  const history=data[HISTORY]||[],last=history[0],now=Date.now();
  // 連続編集では開始前の設定を残し、最終編集時刻だけ更新する。
  // 時刻は永続化し、サービスワーカーが再起動しても同じまとまりとして扱う。
  const elapsed=now-(last?.lastChanged??last?.time);
  const grouped=['editor-save','chrome-sync'].includes(reason)&&last?.reason===reason&&elapsed>=0&&elapsed<5*60*1000;
  const entries=grouped?[{...last,lastChanged:now},...history.slice(1)]:[{time:now,lastChanged:now,reason,settings:old},...history];
  await chrome.storage.local.set({[HISTORY]:entries.slice(0,10)});
 }

 async recordLocal(settings:Settings){
  const s=await this.state();
  if(s.doc&&JSON.stringify(s.doc.settings)===JSON.stringify(settings))return;
  s.doc=newDoc(settings,s.device,s.doc?[s.doc]:[]);s.pending=true;
  s.message=s.enabled?t("m_c44d128a92ff"):t("m_46c87f5d6b04");
  await this.remember(s);
 }
 async schedule(enabled:boolean){
  if(!chrome.alarms)return;
  if(!enabled){await chrome.alarms.clear(SYNC_ALARM);return;}
  if(!await chrome.alarms.get(SYNC_ALARM))await chrome.alarms.create(SYNC_ALARM,{delayInMinutes:1,periodInMinutes:5});
 }
 async reconcile(){
  const s=await this.state();await this.remember(s);await this.schedule(s.enabled);if(!s.enabled)return;
  try{
   const all=await chrome.storage.sync.get(null),remote=await decodeRemote(all);
   if(s.pending&&s.doc){
    const items=await encodeDoc(s.doc,s.device),prefix='xpf:'+s.device+':';
    const future={...all,...items};for(const k of Object.keys(future))if(k.startsWith(prefix)&&!(k in items))delete future[k];
    assertQuota(future);await chrome.storage.sync.set(items);
    const stale=Object.keys(all).filter(k=>k.startsWith(prefix)&&!(k in items));if(stale.length)await chrome.storage.sync.remove(stale);
    s.pending=false;
   }
   const candidates=heads([...remote,...(s.doc?[s.doc]:[])]);
   if(new Set(candidates.map(d=>JSON.stringify(d.settings))).size>1){s.conflicts=candidates;s.message=t("m_d6009c667f5c");}
   else if(candidates.length){
    const chosen=candidates[0];s.conflicts=[];
    // 同内容の並行更新は時計を結合する。次の編集時に全てを継承。
    const clock:Record<string,number>={};for(const d of candidates)for(const[k,v]of Object.entries(d.clock))clock[k]=Math.max(clock[k]||0,v);
    s.doc={...chosen,clock};await this.history(chosen.settings,'chrome-sync');await chrome.storage.local.set({[SETTINGS]:chosen.settings});
    s.message=t("m_2115d1bddeae")+new Date().toLocaleTimeString()+t("m_59493c210ed4");
   }else s.message=t("m_62c0bebadcb4");
   await this.remember(s);
  }catch(e){s.message=e instanceof Error?e.message:String(e);await this.remember(s);}
 }
 async setEnabled(enabled:boolean){const s=await this.state();s.enabled=enabled;s.message=enabled?t("m_cce48784c8ce"):t("m_46c87f5d6b04");if(enabled&&!s.doc){const settings=validate((await chrome.storage.local.get(SETTINGS))[SETTINGS]??defaults);s.doc=newDoc(settings,s.device,[]);s.pending=true;}await this.remember(s);}
 async resolve(value:unknown){
  const chosen=parseDoc(JSON.stringify(value)),s=await this.state();
  const remote=await decodeRemote(await chrome.storage.sync.get(null));const current=heads([...remote,...(s.doc?[s.doc]:[])]);
  if(JSON.stringify(current)!==JSON.stringify(s.conflicts))throw Error(t("m_6b7b75731795"));
  if(!current.some(d=>JSON.stringify(d)===JSON.stringify(chosen)))throw Error(t("m_dfcfb4733d99"));
  await this.history(chosen.settings,'conflict-resolution');s.doc=newDoc(chosen.settings,s.device,current);s.pending=true;s.conflicts=[];
  await chrome.storage.local.set({[SETTINGS]:chosen.settings,[STATE]:s});await this.reconcile();
 }
}
