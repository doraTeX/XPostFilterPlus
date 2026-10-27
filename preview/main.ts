import {t} from '../src/shared/i18n';
import {mountDashboard} from '../src/dashboard/ui';
import {defaults} from '../src/shared/settings';
import {bindCloseEvents} from '../src/dashboard/close-events';
import {renderSettingsError} from '../src/dashboard/error';
const params=new URL(location.href).searchParams,en=params.get('lang')==='en',unset=params.get('state')==='unset',failSave=params.get('save')==='fail';
document.documentElement.lang=en?'en':'ja';document.getElementById('preview-banner')!.textContent=t('previewNotice');
const embedded=window.parent!==window;document.documentElement.classList.toggle('embedded',embedded);if(embedded)document.getElementById('preview-banner')!.hidden=true;
const state:any={settings:{...defaults,rows:en?['spoiler','giveaway']:['ネタバレ','プレゼント企画'],aiEnabled:true,aiConditions:en?['Posts mocking or insulting other people','Promotions encouraging a purchase']:['他人を嘲笑・罵倒しているポスト','商品の購入を促す宣伝']},local:{provider:'jev',profiles:unset?{}:{jev:{key:'preview-placeholder'}}},history:[],ai:{ready:!unset,configured:!unset,permitted:!unset,stopped:false,blockedUntil:0}};
const page:any={connected:true,debugEnabled:false,tabId:1,title:en?'Sample timeline':'タイムラインのサンプル',url:'https://x.com/home',tabs:[{id:1,title:en?'Sample timeline':'タイムラインのサンプル'}],hiddenWords:en?['spoiler','AI: promotions']:['ネタバレ','AI: 宣伝'],paused:false,message:en?'Check complete. No unclassified posts remain (cached or filtered by keywords).':'確認完了。未判定のポストはありません（キャッシュまたはキーワード除外）。',summary:{target:12,hidden:7,keyword:3,aiHidden:4,cached:9,pending:0,prior:6,fresh:3,uniquePrior:6,uniqueFresh:3},stats:{requests:4,success:3,failed:0,refused:1,input:420,output:4,unknown:0,lastError:''},rows:[]};
const sync:any={enabled:false,message:en?'Chrome sync is off':'Chrome同期は停止中です',conflicts:[]};
let dashboard:Awaited<ReturnType<typeof mountDashboard>>|undefined;
const requestClose=async()=>{if(dashboard)return dashboard.close();if(embedded)parent.postMessage({type:'XPF_CLOSE_EMPTY'},location.origin);};
const unbind=bindCloseEvents(requestClose,embedded,[location.origin]);
window.addEventListener('pagehide',()=>{unbind();dashboard?.dispose();},{once:true});
void mountDashboard(document.getElementById('app')!,{call:async(type,data)=>{
 if(type==='GET'&&params.get('state')==='broken')throw Error(en?'Preview settings load failure':'プレビューの設定読み込み失敗');
 if(type==='DEBUG_SET'){page.debugEnabled=!!data!.enabled;return structuredClone(page);}
 if(type==='PAGE')return structuredClone(page);if(type==='PAUSE'){page.paused=!page.paused;return structuredClone(page);}
 if(type==='CLOSE'&&embedded){parent.postMessage({type:'XPF_PREVIEW_CLOSED'},location.origin);return null;}
 if(type==='SAVE'){if(failSave)throw Error(en?'Preview save failure':'プレビューの保存失敗');state.settings=data!.settings;state.local=data!.local;state.ai.ready=state.ai.configured=state.ai.permitted=!!state.local.profiles[state.local.provider]?.key;}
 if(type==='PERMISSION')return true;
 if(type==='SYNC_STATUS'||type==='SYNC')return structuredClone(sync);
 if(type==='SYNC_ENABLED'){sync.enabled=!!data!.enabled;sync.message=en?(sync.enabled?'Chrome sync is on':'Chrome sync is off'):(sync.enabled?'Chrome同期は有効です':'Chrome同期は停止中です');return structuredClone(sync);}
 return structuredClone(state);
}}).then(ui=>{dashboard=ui;if(embedded)ui.focus();}).catch(error=>renderSettingsError(document.getElementById('app')!,error,requestClose));
