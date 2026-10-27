import {PROVIDERS} from './ai.js';
import {t,language} from './i18n';
export type RowKind='keyword-excluded-row'|'excluded-row'|'pending-row'|'error-row'|'other-row';
export type DecisionRow={postId:string;author?:string;text:string;condition:string;provider:string;model:string;score:number|null;threshold:number|null;aiUsage?:'off'|'not-fetched';source:string;display:string;reason:string;elapsedMs:number|null;kind?:RowKind;keyword?:boolean};
export function aiUsageLabel(row:DecisionRow){if(row.keyword)return t('aiUnusedKeyword');if(!row.provider)return row.aiUsage==='off'?t('aiUnusedOff'):t('aiUnusedPending');const label=[(PROVIDERS as Record<string,string>)[row.provider]||row.provider,row.model].filter(Boolean).join(' / ');return row.score===null?label+t('aiResultPending'):label;}
function authorLabel(author?:string){return typeof author==='string'&&/^[A-Za-z0-9_]{1,50}$/.test(author)?'@'+author:'—';}
export function reportCells(row:DecisionRow){return [row.postId,authorLabel(row.author),row.text,row.condition,aiUsageLabel(row),row.score??'',row.threshold??'',row.source,row.display,row.reason,row.elapsedMs??''];}
export const reportHeaders=()=>[t('m_c7fb186f3320'),t('reportAuthor'),t('m_18cafaff5560'),t('m_16bb1d2b098c'),t('m_6544a39a3370'),t('m_2d65978ddae0'),t('m_d677a372143c'),t('m_3e84ddf16d62'),t('m_fd8ab3a01727'),t('m_bb66460e6877'),t('m_a7dd620c6dea')];
export function reportRecords(rows:DecisionRow[]){return rows.map(row=>Object.fromEntries(reportHeaders().map((key,i)=>[key,reportCells(row)[i]])));}
// 改行・タブの保持方法と表計算への貼り付け対策もY!News版に合わせる。
export function decisionTSV(rows:DecisionRow[]){const cell=(value:unknown)=>{let s=String(value??'').replace(/\t/g,'\\t').replace(/\r?\n|\r/g,'\\n');if(typeof value==='string'&&/^\s*[=+@-]/.test(s))s="'"+s;return s.includes('"')?'"'+s.replace(/"/g,'""')+'"':s;};return [reportHeaders(),...rows.map(reportCells)].map(row=>row.map(cell).join('\t')).join('\r\n');}
export function fillReport(root:HTMLElement,rows:DecisionRow[],meta:{time?:number;url?:string}={}){
 root.replaceChildren();
 const h=<K extends keyof HTMLElementTagNameMap>(tag:K,text='',parent:HTMLElement=root,cls='')=>{const e=document.createElement(tag);e.textContent=text;if(cls)e.className=cls;parent.append(e);return e;};
 const stamp=h('p',t('reportStamp',[new Date(meta.time||Date.now()).toLocaleString(language()),rows.length]));
 if(meta.url){h('br','',stamp);stamp.append(document.createTextNode(t('reportSource')));try{const url=new URL(meta.url);if(url.protocol==='https:'&&['x.com','twitter.com'].includes(url.hostname)){const link=h('a',url.href,stamp);link.href=url.href;link.target='_blank';link.rel='noopener noreferrer';}}catch{}}
 const filters:[RowKind,string,string,string][]=[['keyword-excluded-row',t('filterKeyword'),'#e2e3ef',t('guideKeyword')],['excluded-row',t('filterExcluded'),'#fff0f3',t('guideExcluded')],['pending-row',t('filterPending'),'#d9f2f5',t('guidePending')],['error-row',t('filterError'),'#ffdfbd',t('guideError')],['other-row',t('filterVisible'),'#e9eff5',t('guideVisible')]];
 const kind=(row:DecisionRow):RowKind=>row.kind==='keyword-excluded-row'?'keyword-excluded-row':row.aiUsage==='off'?'other-row':row.kind||(!row.provider?'pending-row':row.score===null?'error-row':row.threshold!==null&&row.score>=row.threshold?'excluded-row':'other-row');
 const filterCounts=new Map<RowKind,number>();for(const row of rows){const key=kind(row);filterCounts.set(key,(filterCounts.get(key)||0)+1);}
 const controls=h('fieldset','',root,'filters');h('legend',t('reportFilters'),controls);const actions=h('div','',controls,'filter-actions');
 const all=h('button',t('reportSelectAll'),actions),none=h('button',t('reportSelectNone'),actions);all.type=none.type='button';const inputs:HTMLInputElement[]=[];

 for(const [name,label,color]of filters){const l=h('label','',controls,'tag filter-label');l.style.background=color;const input=h('input','',l);input.type='checkbox';input.checked=true;input.dataset.filter=name;l.append(document.createTextNode(`${label} (${filterCounts.get(name)||0})`));inputs.push(input);}
 const guide=h('dl','',root,'filter-guide');for(const [,label,,explanation]of filters){h('dt',label,guide);h('dd',explanation,guide);}
 const counter=h('p','',root);counter.id='filter-count';counter.setAttribute('role','status');const empty=h('p',t('reportFilterEmpty'),root);empty.id='filter-empty';
 const wrap=h('div','',root,'table-wrap'),table=h('table','',wrap,'report-table'),head=h('thead','',table),heading=h('tr','',head);for(const label of reportHeaders()){const th=h('th',label,heading);th.scope='col';}
 const body=h('tbody','',table);
 for(const row of rows){const tr=h('tr','',body,kind(row));for(const [i,value]of reportCells(row).entries()){const td=h('td','',tr);if(i===0&&/^\d+$/.test(row.postId)){const link=h('a',String(value),td);link.href='https://x.com/i/status/'+row.postId;link.target='_blank';link.rel='noopener noreferrer';}else if(i===1&&authorLabel(row.author)!=='—'){const link=h('a',String(value),td);link.href='https://x.com/'+row.author;link.target='_blank';link.rel='noopener noreferrer';}else if(i===5&&kind(row)==='excluded-row'&&row.score!==null&&row.threshold!==null&&row.score>=row.threshold)h('strong',String(value),td,'decisive-score');else td.textContent=String(value);}}
 function update(){const selected=new Set(inputs.filter(e=>e.checked).map(e=>e.dataset.filter));let count=0;for(const tr of Array.from(body.rows)){tr.hidden=!selected.has(tr.className);if(!tr.hidden)count++;}counter.textContent=t('reportFilterCount',[count,rows.length]);empty.hidden=count!==0;}
 inputs.forEach(e=>e.onchange=update);all.onclick=()=>{inputs.forEach(e=>e.checked=true);update();};none.onclick=()=>{inputs.forEach(e=>e.checked=false);update();};update();
 if(!rows.length)h('p',t('m_4b484f018ece'));
}
