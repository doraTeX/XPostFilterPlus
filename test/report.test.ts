import {it,expect} from 'vitest';
import {decisionTSV,fillReport,reportRecords,type DecisionRow} from '../src/shared/report';
const row:DecisionRow={postId:'123',text:'<img src=x onerror=alert(1)>\t本文\n次行',condition:'除外',provider:'clef',model:'clef-flash',score:.9,threshold:.8,source:'API',display:'非表示',reason:'判定済み',elapsedMs:120};
it('2列目に投稿者のプロフィールリンクを表示し、TSVとConsoleにも含める',()=>{
 const root=document.createElement('div');const author={...row,author:'Actual_Author'};fillReport(root,[author,{...row,author:'javascript:alert(1)'}]);
 expect(root.querySelectorAll('th')[1].textContent).toBe('投稿者');const link=root.querySelector('tbody tr td:nth-child(2) a') as HTMLAnchorElement;
 expect(link.textContent).toBe('@Actual_Author');expect(link.href).toBe('https://x.com/Actual_Author');expect(link.rel).toContain('noopener');
 expect(root.querySelectorAll('tbody tr')[1].querySelector('td:nth-child(2) a')).toBeNull();
 expect(decisionTSV([author])).toContain("123\t'@Actual_Author\t");expect(reportRecords([author])[0]['投稿者']).toBe('@Actual_Author');
});
it('同じ非表示ポストでも、しきい値を超えた除外理由の値だけを強調する',()=>{
 const root=document.createElement('div');
 fillReport(root,[{...row,score:.61,kind:'excluded-row'},{...row,score:.82,kind:'excluded-row'},{...row,score:.8,kind:'excluded-row'},{...row,score:.9,kind:'other-row'}]);
 expect(Array.from(root.querySelectorAll('.decisive-score')).map(e=>e.textContent)).toEqual(['0.82','0.8']);
});
it('AIがOFFの行は通常表示に数え、キーワード除外とONの未取得を混同しない',()=>{
 const root=document.createElement('div');
 fillReport(root,[
  {...row,provider:'',model:'',score:null,aiUsage:'off'},
  {...row,aiUsage:'off',kind:'excluded-row'},
  {...row,provider:'',model:'',score:null,aiUsage:'off',keyword:true,kind:'keyword-excluded-row'},
  {...row,provider:'',model:'',score:null,aiUsage:'not-fetched'}
 ]);
 expect(root.querySelectorAll('tbody tr.other-row')).toHaveLength(2);
 expect(root.querySelectorAll('tbody tr.pending-row')).toHaveLength(1);
 expect(root.querySelectorAll('tbody tr.keyword-excluded-row')).toHaveLength(1);
 expect(root.querySelector('[data-filter="other-row"]')!.parentElement!.textContent).toContain('通常表示 (2)');
 expect(root.querySelector('[data-filter="pending-row"]')!.parentElement!.textContent).toContain('未取得 (1)');
});
it('本文をHTMLとして実行せずに表を表示する',()=>{const root=document.createElement('div');fillReport(root,[row]);expect(root.querySelector('img')).toBeNull();expect(root.textContent).toContain('<img');expect(root.querySelectorAll('tbody tr')).toHaveLength(1);});
it('TSVの本文の改行とタブで列や行が増えない',()=>{const lines=decisionTSV([row]).split('\n');expect(lines).toHaveLength(2);expect(lines[1].split('\t')).toHaveLength(19);expect(lines[1]).toContain('clef-flash');});
it('英語のTSV見出しは表示時の言語に合わせる',()=>{document.documentElement.lang='en';try{expect(decisionTSV([])).toContain('Post text\tCondition\tAI provider');expect(decisionTSV([])).not.toContain('ポスト');}finally{document.documentElement.lang='ja';}});
it('キーワード一致ではAIの代わりに不使用（通常キーワード）を表示する',()=>{const keyword={...row,provider:'',model:'',keyword:true,score:null,kind:'keyword-excluded-row' as const};expect(decisionTSV([keyword])).toContain('不使用（通常キーワード）');expect(decisionTSV([keyword])).not.toContain('clef');});
it('判定色の区分で絞り込み、全選択・全解除で行数を更新する',()=>{const root=document.createElement('div');document.body.append(root);const rows:DecisionRow[]=[{...row,kind:'keyword-excluded-row',keyword:true},{...row,kind:'excluded-row'},{...row,kind:'pending-row',provider:'',model:'',score:null},{...row,kind:'error-row',score:null},{...row,kind:'other-row',score:.1}];fillReport(root,rows);expect(root.querySelector('#filter-count')!.textContent).toBe('5 / 5 行を表示');const input=root.querySelector('[data-filter="excluded-row"]') as HTMLInputElement;input.click();expect((root.querySelector('tr.excluded-row') as HTMLElement).hidden).toBe(true);expect(root.querySelector('#filter-count')!.textContent).toBe('4 / 5 行を表示');Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='すべて選択解除')!.click();expect(root.querySelector('#filter-count')!.textContent).toBe('0 / 5 行を表示');Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='すべて選択')!.click();expect(root.querySelector('#filter-count')!.textContent).toBe('5 / 5 行を表示');});

it.each(['no-conditions','paused','filter-off'] as const)('%sの行は通常表示に分類し、不使用の理由を日英で表示する',aiUsage=>{
 for(const lang of ['ja','en']){document.documentElement.lang=lang;try{
  const root=document.createElement('div'),unused:DecisionRow={...row,provider:'',model:'',score:null,threshold:null,aiUsage,kind:'pending-row'};fillReport(root,[unused]);
  expect(root.querySelectorAll('tbody .other-row')).toHaveLength(1);expect(root.querySelectorAll('tbody .pending-row')).toHaveLength(0);
  const label=reportRecords([unused])[0][lang==='ja'?'利用AI':'AI provider'];expect(label).toContain(lang==='ja'?'不使用':'Not used');expect(label).not.toContain(lang==='ja'?'未取得':'not fetched');
 }finally{document.documentElement.lang='ja';}}
});
it.each(['ja','en'])('%sの折りたたみ詳細を展開すると状態・ログ・本文を安全に表示し、再展開で重複しない',lang=>{
 document.documentElement.lang=lang;
 try{
  const root=document.createElement('div'),diagnostics={p:{processingError:false,lastProcessedAt:'2026-10-27T03:00:00.000Z',processingLog:['処理 <img onerror=bad()>'],displayLog:['表示変更'],sentText:'完全な本文\n<script>bad()</script>',inputOrigin:'cache' as const}};
  fillReport(root,[{...row,detailsId:'p',aiEnabled:true,temporarilyReleased:false}],{diagnostics});
  expect(root.querySelector('thead th:last-child')!.textContent).toBe(lang==='ja'?'詳細':'Details');
  const details=root.querySelector<HTMLDetailsElement>('tbody details')!;expect(details.open).toBe(false);expect(details.querySelector('pre')).toBeNull();details.open=true;details.dispatchEvent(new Event('toggle'));
  expect(details.textContent).toContain(lang==='ja'?'最終処理時刻':'Last processed in this tab');expect(details.textContent).toContain(diagnostics.p.sentText);expect(details.textContent).toContain(lang==='ja'?'このタブからの新規送信はありません':'No new request was sent');
  expect(details.querySelectorAll('pre')).toHaveLength(3);expect(root.querySelector('script,img')).toBeNull();details.open=false;details.dispatchEvent(new Event('toggle'));details.open=true;details.dispatchEvent(new Event('toggle'));expect(details.querySelectorAll('pre')).toHaveLength(3);
  const tsv=decisionTSV([{...row,detailsId:'p'}],diagnostics);expect(tsv).toContain('完全な本文\\n<script>');expect(tsv.split('\r\n')).toHaveLength(2);expect(reportRecords([{...row,detailsId:'p'}],diagnostics)[0][lang==='ja'?'処理ログ':'Processing log']).toContain('処理 <img');
 }finally{document.documentElement.lang='ja';}
});
it('詳細のない旧形式の判定表でも、記録のない項目を捏造せず表示する',()=>{
 const root=document.createElement('div');fillReport(root,[row]);const details=root.querySelector<HTMLDetailsElement>('details')!;details.open=true;details.dispatchEvent(new Event('toggle'));
 expect(details.textContent).toContain('このタブでの処理記録なし');expect(details.textContent).toContain('送信テキストの記録なし');expect(details.querySelectorAll('pre')).toHaveLength(3);
});

it.each(['ja','en'])('未取得行の接続先・モデルと結果待ちを%sの表・TSV・Consoleに表示する',lang=>{
 document.documentElement.lang=lang;try{const pending={...row,provider:'jev',model:'jev-1.13.0',score:null,kind:'pending-row' as const,aiUsage:'not-fetched' as const,reason:lang==='ja'?'通信枠待ち':'Waiting for a request slot'};const root=document.createElement('div');fillReport(root,[pending]);
 const expected='Jev / jev-1.13.0'+(lang==='ja'?'（判定結果なし）':' (no decision result)');expect(root.querySelector('tbody')!.textContent).toContain(expected);expect(decisionTSV([pending])).toContain(expected);expect(Object.values(reportRecords([pending])[0])).toContain(expected);expect(root.querySelectorAll('tr.pending-row')).toHaveLength(1);
 }finally{document.documentElement.lang='ja';}
});
