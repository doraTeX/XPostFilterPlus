import {it,expect} from 'vitest';
import {decisionTSV,fillReport,type DecisionRow} from '../src/shared/report';
const row:DecisionRow={postId:'123',text:'<img src=x onerror=alert(1)>\t本文\n次行',condition:'除外',provider:'clef',model:'clef-flash',score:.9,threshold:.8,source:'API',display:'非表示',reason:'判定済み',elapsedMs:120};
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
it('TSVの本文の改行とタブで列や行が増えない',()=>{const lines=decisionTSV([row]).split('\n');expect(lines).toHaveLength(2);expect(lines[1].split('\t')).toHaveLength(10);expect(lines[1]).toContain('clef-flash');});
it('英語のTSV見出しは表示時の言語に合わせる',()=>{document.documentElement.lang='en';try{expect(decisionTSV([])).toContain('Post text\tCondition\tAI provider');expect(decisionTSV([])).not.toContain('ポスト');}finally{document.documentElement.lang='ja';}});
it('キーワード一致ではAIの代わりに不使用（通常キーワード）を表示する',()=>{const keyword={...row,provider:'',model:'',keyword:true,score:null,kind:'keyword-excluded-row' as const};expect(decisionTSV([keyword])).toContain('不使用（通常キーワード）');expect(decisionTSV([keyword])).not.toContain('clef');});
it('判定色の区分で絞り込み、全選択・全解除で行数を更新する',()=>{const root=document.createElement('div');document.body.append(root);const rows:DecisionRow[]=[{...row,kind:'keyword-excluded-row',keyword:true},{...row,kind:'excluded-row'},{...row,kind:'pending-row',provider:'',model:'',score:null},{...row,kind:'error-row',score:null},{...row,kind:'other-row',score:.1}];fillReport(root,rows);expect(root.querySelector('#filter-count')!.textContent).toBe('5 / 5 行を表示');const input=root.querySelector('[data-filter="excluded-row"]') as HTMLInputElement;input.click();expect((root.querySelector('tr.excluded-row') as HTMLElement).hidden).toBe(true);expect(root.querySelector('#filter-count')!.textContent).toBe('4 / 5 行を表示');Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='すべて選択解除')!.click();expect(root.querySelector('#filter-count')!.textContent).toBe('0 / 5 行を表示');Array.from(root.querySelectorAll('button')).find(b=>b.textContent==='すべて選択')!.click();expect(root.querySelector('#filter-count')!.textContent).toBe('5 / 5 行を表示');});
