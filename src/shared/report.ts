import {PROVIDERS} from './ai.js';
import {t,language} from './i18n';
export type RowKind='keyword-excluded-row'|'excluded-row'|'pending-row'|'error-row'|'other-row';
export type AIUsage='off'|'no-conditions'|'paused'|'filter-off'|'not-fetched';
export type DecisionDetails={processingError:boolean;lastProcessedAt:string|null;processingLog:string[];displayLog:string[];sentText:string|null;postText?:string;inputOrigin?:'api'|'cache'|'shared'|'none'|'unknown'};
export type Diagnostics=Record<string,DecisionDetails>;
export type DecisionRow={postId:string;author?:string;text:string;condition:string;provider:string;model:string;providerPlanned?:boolean;score:number|null;threshold:number|null;aiUsage?:AIUsage;source:string;display:string;reason:string;elapsedMs:number|null;kind?:RowKind;keyword?:boolean;aiEnabled?:boolean;temporarilyReleased?:boolean;detailsId?:string;details?:DecisionDetails};
export function aiUsageLabel(row:DecisionRow){if(row.keyword)return t('aiUnusedKeyword');if(!row.provider){const labels:Record<AIUsage,string>={'off':'aiUnusedOff','no-conditions':'aiUnusedNoConditions','paused':'aiUnusedPaused','filter-off':'aiUnusedFilterOff','not-fetched':'aiUnusedPending'};return t(labels[row.aiUsage||'not-fetched']);}const label=[(PROVIDERS as Record<string,string>)[row.provider]||row.provider,row.model].filter(Boolean).join(' / ');return row.score===null?label+t(row.providerPlanned?'aiNotClassified':'aiResultPending'):label;}
function authorLabel(author?:string){return typeof author==='string'&&/^[A-Za-z0-9_]{1,50}$/.test(author)?'@'+author:'—';}
export function reportCells(row:DecisionRow){return [row.postId,authorLabel(row.author),row.text,row.condition,aiUsageLabel(row),row.score??'',row.threshold??'',row.source,row.display,row.reason,row.elapsedMs??''];}
export const reportHeaders=()=>[t('m_c7fb186f3320'),t('reportAuthor'),t('m_18cafaff5560'),t('m_16bb1d2b098c'),t('m_6544a39a3370'),t('m_2d65978ddae0'),t('m_d677a372143c'),t('m_3e84ddf16d62'),t('m_fd8ab3a01727'),t('m_bb66460e6877'),t('m_a7dd620c6dea')];
function detailOf(row:DecisionRow,diagnostics:Diagnostics){return row.details||(row.detailsId?diagnostics[row.detailsId]:undefined);}
const yesNo=(value:boolean|undefined)=>value===undefined?'—':t(value?'detailYes':'detailNo');
function detailCells(row:DecisionRow,diagnostics:Diagnostics){const detail=detailOf(row,diagnostics);return [yesNo(detail?.processingError),detail?.lastProcessedAt||t('detailNoProcessingTime'),yesNo(row.keyword),yesNo(row.temporarilyReleased),yesNo(row.aiEnabled),detail?.processingLog.join('\n')||t('detailNoProcessingLog'),detail?.displayLog.join('\n')||t('detailNoDisplayLog'),detail?.sentText??t('detailNoSentText')];}
const detailHeaders=()=>['detailProcessingError','detailLastProcessed','detailKeyword','detailReleased','detailAIEnabled','detailProcessingLog','detailDisplayLog','detailSentText'].map(key=>t(key));
export function reportRecords(rows:DecisionRow[],diagnostics:Diagnostics={}){const headers=[...reportHeaders(),...detailHeaders()];return rows.map(row=>{const values=[...reportCells(row),...detailCells(row,diagnostics)];return Object.fromEntries(headers.map((key,i)=>[key,values[i]]));});}
// 改行・タブの保持方法と表計算への貼り付け対策もY!News版に合わせる。
export function decisionTSV(rows:DecisionRow[],diagnostics:Diagnostics={}){const cell=(value:unknown)=>{let s=String(value??'').replace(/\t/g,'\\t').replace(/\r?\n|\r/g,'\\n');if(typeof value==='string'&&/^\s*[=+@-]/.test(s))s="'"+s;return s.includes('"')?'"'+s.replace(/"/g,'""')+'"':s;};return [[...reportHeaders(),...detailHeaders()],...rows.map(row=>[...reportCells(row),...detailCells(row,diagnostics)])].map(row=>row.map(cell).join('\t')).join('\r\n');}
export function fillReport(root:HTMLElement,rows:DecisionRow[],meta:{time?:number;url?:string;diagnostics?:Diagnostics}={}){
 root.replaceChildren();
 const h=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',parent:HTMLElement=root,cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;};
 const stamp=h('p',t('reportStamp',[new Date(meta.time||Date.now()).toLocaleString(language()),rows.length]));
 if(meta.url){h('br','',stamp);stamp.append(document.createTextNode(t('reportSource')));try{const url=new URL(meta.url);if(url.protocol==='https:'&&['x.com','twitter.com'].includes(url.hostname)){const link=h('a',url.href,stamp);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';}}catch{}}
 const searchLabel=h('label',t('reportTextFilter'),root,'text-filter'),search=h('input','',searchLabel);search.type='search';search.id='report-text-filter';search.placeholder=t('reportTextFilterPlaceholder');
 const filters:[RowKind,string,string,string][]=[['keyword-excluded-row',t('filterKeyword'),'#e2e3ef',t('guideKeyword')],['excluded-row',t('filterExcluded'),'#fff0f3',t('guideExcluded')],['pending-row',t('filterPending'),'#d9f2f5',t('guidePending')],['error-row',t('filterError'),'#ffdfbd',t('guideError')],['other-row',t('filterVisible'),'#e9eff5',t('guideVisible')]];
 const kind=(row:DecisionRow):RowKind=>row.kind==='keyword-excluded-row'?'keyword-excluded-row':row.aiUsage&&row.aiUsage!=='not-fetched'?'other-row':row.kind||(!row.provider?'pending-row':row.score===null?'error-row':row.threshold!==null&&row.score>=row.threshold?'excluded-row':'other-row');
 const filterCounts=new Map<RowKind,number>();for(const row of rows){const key=kind(row);filterCounts.set(key,(filterCounts.get(key)||0)+1);}
 const controls=h('fieldset','',root,'filters');h('legend',t('reportFilters'),controls);const actions=h('div','',controls,'filter-actions');
 const all=h('button',t('reportSelectAll'),actions),none=h('button',t('reportSelectNone'),actions);all.type=none.type='button';const inputs:HTMLInputElement[]=[],countNodes=new Map<string,HTMLElement>();

 for(const [name,label,color]of filters){const l=h('label','',controls,'tag filter-label');l.style.background=color;const input=h('input','',l);input.type='checkbox';input.checked=true;input.dataset.filter=name;const caption=h('span',`${label} (`,l),count=h('span',String(filterCounts.get(name)||0),caption);count.dataset.filterCount='';countNodes.set(name,count);caption.append(document.createTextNode(')'));inputs.push(input);}
 const guide=h('dl','',root,'filter-guide');for(const [,label,,explanation]of filters){h('dt',label,guide);h('dd',explanation,guide);}
 const counter=h('p','',root);counter.id='filter-count';counter.setAttribute('role','status');const empty=h('p',t('reportFilterEmpty'),root);empty.id='filter-empty';
 const wrap=h('div','',root,'table-wrap'),table=h('table','',wrap,'report-table'),head=h('thead','',table),heading=h('tr','',head);for(const label of [...reportHeaders(),t('detailColumn')]){const th=h('th',label,heading);th.scope='col';}
 const body=h('tbody','',table);
 for(const row of rows){const tr=h('tr','',body,kind(row));for(const [i,value]of reportCells(row).entries()){const td=h('td','',tr);if(i===0&&/^\d+$/.test(row.postId)){const link=h('a',String(value),td);link.href='https://x.com/i/status/'+row.postId;link.target='_blank';link.rel='noopener noreferrer';}else if(i===1&&authorLabel(row.author)!=='—'){const link=h('a',String(value),td);link.href='https://x.com/'+row.author;link.target='_blank';link.rel='noopener noreferrer';}else if(i===5&&kind(row)==='excluded-row'&&row.score!==null&&row.threshold!==null&&row.score>=row.threshold)h('strong',String(value),td,'decisive-score');else td.textContent=String(value);}
  const td=h('td','',tr,'detail'),details=h('details','',td);h('summary',t('detailSummary'),details);
  // 展開したときだけ本文とログのDOMを作り、長いポスト・多条件の表でも初期描画を軽くする。
  details.addEventListener('toggle',()=>{if(!details.open||details.dataset.loaded)return;details.dataset.loaded='true';
   const detail=detailOf(row,meta.diagnostics||{}),list=h('dl','',details);
   for(const [label,value]of [['detailProcessingError',yesNo(detail?.processingError)],['detailStatus',row.reason],['detailLastProcessed',detail?.lastProcessedAt||t('detailNoProcessingTime')],['detailSource',row.source],['detailKeyword',yesNo(row.keyword)],['detailReleased',yesNo(row.temporarilyReleased)],['detailAIEnabled',yesNo(row.aiEnabled)]]){h('dt',t(label),list);h('dd',value,list);}
   if(detail?.postText){h('h3',t('m_18cafaff5560'),details);h('pre',detail.postText,details);}
   h('h3',t('detailProcessingHeading'),details);h('pre',detail?.processingLog.join('\n')||t('detailNoProcessingLog'),details);
   h('h3',t('detailDisplayHeading'),details);h('pre',detail?.displayLog.join('\n')||t('detailNoDisplayLog'),details);
   h('h3',t('detailSentText'),details);
   if(detail?.inputOrigin==='cache'||detail?.inputOrigin==='shared')h('p',t(detail.inputOrigin==='cache'?'detailCachedInput':'detailSharedInput'),details,'hint');
   h('pre',detail?.sentText??t('detailNoSentText'),details);
  });
 }
 // 本文はポストごとに保持し、小文字化も条件行の数だけ繰り返さない。
 const normalized=new WeakMap<DecisionDetails,string>(),texts=rows.map(row=>{
  const detail=detailOf(row,meta.diagnostics||{});if(!detail)return row.text.toLowerCase();
  let text=normalized.get(detail);if(text===undefined){text=(detail.postText??detail.sentText??row.text).toLowerCase();normalized.set(detail,text);}return text;
 });
 function update(){const selected=new Set(inputs.filter(e=>e.checked).map(e=>e.dataset.filter)),query=search.value.trim().toLowerCase(),matches=new Map<string,number>();let count=0;for(const [i,tr] of Array.from(body.rows).entries()){const match=texts[i].includes(query);if(match)matches.set(tr.className,(matches.get(tr.className)||0)+1);tr.hidden=!selected.has(tr.className)||!match;if(!tr.hidden)count++;}for(const [name,node]of countNodes)node.textContent=String(matches.get(name)||0);counter.textContent=t('reportFilterCount',[count,rows.length]);empty.hidden=count!==0;}
 search.addEventListener('input',update);inputs.forEach(e=>e.onchange=update);all.onclick=()=>{inputs.forEach(e=>e.checked=true);update();};none.onclick=()=>{inputs.forEach(e=>e.checked=false);update();};update();
 if(!rows.length)h('p',t('m_4b484f018ece'));
}
