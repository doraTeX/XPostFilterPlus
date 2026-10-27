import {afterEach,it,expect,vi} from 'vitest';
import {start} from '../src/content/engine.js';
import {defaults} from '../src/shared/settings';
let engine:Awaited<ReturnType<typeof start>>|undefined;
afterEach(()=>{engine?.dispose();engine=undefined;document.body.replaceChildren();vi.restoreAllMocks();});
function fixture(body='セール実施中',id='123'){
 document.body.innerHTML=`<div data-testid="cellInnerDiv"><article role="article"><span>宣伝するユーザー名</span><a href="/a/status/${id}"><time>今日</time></a><div data-testid="tweetText">${body}</div><div data-testid="quoteTweet"><div data-testid="tweetText">引用文広告</div></div></article></div>`;
 return document.querySelector('[data-testid="cellInnerDiv"]')!;
}
function mock(rows=['セール'],ai=false,decide:()=>Promise<any>=async()=>({scores:[.95]})){
 const state={settings:{...defaults,rows,aiEnabled:ai,aiConditions:['宣伝']},provider:'jev',revision:1,ai:{ready:true,stopped:false,blockedUntil:0}};
 const api={call:vi.fn(async(type:string)=>type==='GET'?structuredClone(state):type==='DECIDE'?decide():undefined),listen:()=>()=>{}};
 return {api,state};
}
async function settle(){for(let i=0;i<30;i++)await Promise.resolve();}
it.each(['pause','disabled'])('%sでもキーワード一致の記録を保持し、未取得のAI条件へ置き換えない',async mode=>{
 const cell=fixture(),{api,state}=mock(['セール'],true);if(mode==='disabled')state.settings.enabled=false;
 engine=await start(api);if(mode==='pause')engine.pause();await settle();
 const report=engine.snapshot();expect(cell.hasAttribute('data-xpf-hidden')).toBe(false);
 expect(report.rows).toHaveLength(1);expect(report.rows[0]).toMatchObject({condition:'セール',keyword:true,kind:'other-row',display:'表示',source:'キーワード',score:null,provider:''});
 expect(report.rows[0].reason).toContain('通常キーワードに一致');expect(report.rows[0].reason).not.toContain('で除外');
 expect(report.summary).toMatchObject({hidden:0,keyword:0,pending:0});expect(api.call.mock.calls.some(([type])=>type==='DECIDE')).toBe(false);
 if(mode==='pause')engine.pause();else{state.settings.enabled=true;await engine.refresh();}
 expect(cell.hasAttribute('data-xpf-hidden')).toBe(true);expect(engine.snapshot().rows[0].kind).toBe('keyword-excluded-row');
});
it('フィルターOFFで確定した除外率を、ONに戻しても同じポストへ再適用しない',async()=>{
 document.body.innerHTML=[1,2].map(id=>`<div data-testid="cellInnerDiv"><article role="article"><a href="/a/status/${id}"><time>今</time></a><div data-testid="tweetText">対象${id}</div></article></div>`).join('');
 const {api,state}=mock(['対象||rate:50']);state.settings.enabled=false;engine=await start(api);
 expect(document.querySelectorAll('[data-xpf-hidden]')).toHaveLength(0);
 state.settings.enabled=true;await engine.refresh();const cells=Array.from(document.querySelectorAll('[data-testid="cellInnerDiv"]'));
 expect(cells.map(c=>c.hasAttribute('data-xpf-hidden'))).toEqual([true,false]);engine.scan();expect(cells.map(c=>c.hasAttribute('data-xpf-hidden'))).toEqual([true,false]);
});
it('除外率の結果をポストごとに保ち、画面外のセル削除・再利用で反転させない',async()=>{
 document.body.innerHTML=[1,2,3].map(id=>`<div data-testid="cellInnerDiv"><article role="article"><a href="/a/status/${id}"><time>今</time></a><div data-testid="tweetText">対象${id}</div></article></div>`).join('');
 const {api}=mock(['対象||rate:50']);engine=await start(api);
 const cells=Array.from(document.querySelectorAll('[data-testid="cellInnerDiv"]'));
 expect(cells.map(c=>c.hasAttribute('data-xpf-hidden'))).toEqual([true,false,true]);
 cells[0].remove();engine.scan();engine.scan();
 expect(cells.slice(1).map(c=>c.hasAttribute('data-xpf-hidden'))).toEqual([false,true]);
 const returned=cells[0].cloneNode(true) as Element;document.body.append(returned);engine.scan();
 expect(returned.hasAttribute('data-xpf-hidden')).toBe(true);
});
it('キーワードを一時解除すると、同じポストに一致する次の語で除外を続ける',async()=>{
 const cell=fixture('AとB'),{api}=mock(['A','B']);engine=await start(api);
 const tag=(word:string)=>engine!.root.querySelector<HTMLButtonElement>(`[data-reason="keyword: ${word}"]`)!;
 tag('A').click();expect(cell.hasAttribute('data-xpf-hidden')).toBe(true);expect(engine.snapshot().rows[0].condition).toBe('B');
 tag('B').click();expect(cell.hasAttribute('data-xpf-hidden')).toBe(false);
 tag('A').click();expect(cell.hasAttribute('data-xpf-hidden')).toBe(true);
});
it('本文と照合設定が同じscanでは正規化を繰り返さない',async()=>{
 fixture('対象の本文');const normal=vi.spyOn(String.prototype,'normalize'),{api}=mock(['不一致','対象||case:1']);engine=await start(api);
 const before=normal.mock.calls.length;engine.scan();engine.scan();
 expect(normal).toHaveBeenCalledTimes(before);
});
it('定期取得用のsnapshotは行データを作らず、明示取得では行を返す',async()=>{
 fixture();const {api}=mock();engine=await start(api);
 expect(engine.snapshot(false).rows).toEqual([]);
 expect(engine.snapshot(false).summary.target).toBe(1);
 expect(engine.snapshot().rows).toHaveLength(1);
});
it('同じポストの別条件で除外されても、除外理由となった条件の行だけを色分けする',async()=>{
 const cell=fixture('判定対象'),{api,state}=mock([],true,async()=>({scores:[.61,.82,.8],provider:'jev'}));
 state.settings.aiConditions=['嘲笑・罵倒','攻撃的口調','別の条件'];engine=await start(api);await settle();
 expect(cell.hasAttribute('data-xpf-hidden')).toBe(true);
 expect(engine.snapshot().rows.map(r=>[r.score,r.kind,r.display])).toEqual([
  [.61,'other-row','非表示'],[.82,'excluded-row','非表示'],[.8,'excluded-row','非表示']
 ]);
 const release=Array.from(engine.root.querySelectorAll<HTMLButtonElement>('.word')).find(b=>b.textContent?.includes('攻撃的口調'))!;
 release.click();
 expect(cell.hasAttribute('data-xpf-hidden')).toBe(true);
 expect(engine.snapshot().rows.map(r=>r.kind)).toEqual(['other-row','other-row','excluded-row']);
});
it('AIがOFFなら通常表示に分類し、キーワードによる除外は区別する',async()=>{
 fixture();const {api}=mock();engine=await start(api);
 expect(engine.snapshot().rows[0].kind).toBe('keyword-excluded-row');
 document.querySelector('[data-testid="tweetText"]')!.textContent='日常の記録';engine.scan();
 const row=engine.snapshot().rows.find(r=>r.text==='日常の記録')!;
 expect(row.kind).toBe('other-row');expect(row.aiUsage).toBe('off');
 expect(engine.snapshot().summary.pending).toBe(0);
 expect(api.call.mock.calls.some(([type])=>type==='DECIDE')).toBe(false);
});
it.each([true,false])('AIがONで結果がなければ接続準備=%sでも未取得に分類する',async ready=>{
 fixture();const {api,state}=mock([],true,()=>new Promise(()=>{}));state.ai.ready=ready;
 engine=await start(api);await settle();
 expect(engine.snapshot().rows[0].kind).toBe('pending-row');
 expect(engine.snapshot().summary.pending).toBe(1);
});
it('キーワードで非表示にし、ツールチップの条件ごとに一時解除・再適用できる',async()=>{
 const cell=fixture(),{api}=mock();engine=await start(api);expect(cell.hasAttribute('data-xpf-hidden')).toBe(true);
 (engine.root.querySelector('.word') as HTMLButtonElement).click();expect(cell.hasAttribute('data-xpf-hidden')).toBe(false);
 (engine.root.querySelector('.word') as HTMLButtonElement).click();expect(cell.hasAttribute('data-xpf-hidden')).toBe(true);
});
it('ユーザー名や引用文を照合せず、本文が変わった表示枠の非表示を外す',async()=>{
 const cell=fixture(),{api}=mock();engine=await start(api);expect(cell.hasAttribute('data-xpf-hidden')).toBe(true);
 document.querySelector('[data-testid="tweetText"]')!.textContent='日常の記録';engine.scan();expect(cell.hasAttribute('data-xpf-hidden')).toBe(false);
});
it('別スクリプトが設定した非表示や目印を一時解除・終了で取り消さない',async()=>{
 const cell=fixture() as HTMLElement;cell.style.display='none';const article=cell.querySelector('article')!;article.dataset.mercariChecked='true';
 const {api}=mock();engine=await start(api);engine.pause();engine.pause();engine.dispose();engine=undefined;
 expect(cell.style.display).toBe('none');expect(article.dataset.mercariChecked).toBe('true');expect(cell.hasAttribute('data-xpf-hidden')).toBe(false);
});
it('AIの遅れた結果で、再利用後の別ポストを非表示にしない',async()=>{
 const cell=fixture('最初の本文'),{api}=mock([],true,()=>new Promise(r=>replies.push(r)));const replies:((v:any)=>void)[]=[];
 engine=await start(api);await settle();expect(replies).toHaveLength(1);
 document.querySelector('[data-testid="tweetText"]')!.textContent='別ポスト';document.querySelector('a')!.setAttribute('href','/a/status/456');engine.scan();await settle();expect(replies).toHaveLength(2);
 replies[0]({scores:[.99]});await settle();expect(cell.hasAttribute('data-xpf-hidden')).toBe(false);
 replies[1]({scores:[.1]});await settle();expect(cell.hasAttribute('data-xpf-hidden')).toBe(false);
});
it('ポスト本文だけをAIへ渡し、拒否後も次のポストを処理する',async()=>{
 fixture('購入を勧める本文');const {api}=mock([],true,async()=>({skipped:'refusal'}));engine=await start(api);await settle();
 const request=api.call.mock.calls.find(c=>c[0]==='DECIDE') as unknown as [string,{post:{text:string}}];expect(request[1].post.text).toBe('購入を勧める本文');expect(engine.root.querySelector('#error')!.textContent).toBe('');
 document.body.insertAdjacentHTML('beforeend','<article role="article"><a href="/b/status/789"><time>今</time></a><div data-testid="tweetText">別の本文</div></article>');engine.scan();await settle();
 expect(api.call.mock.calls.filter(c=>c[0]==='DECIDE')).toHaveLength(2);
});
it('古いモデルの応答を設定変更後の判定に利用しない',async()=>{
 const cell=fixture('本文'),replies:((v:any)=>void)[]=[],{api,state}=mock([],true,()=>new Promise(r=>replies.push(r)));engine=await start(api);await settle();state.revision++;
 await engine.refresh();replies[0]({scores:[.99]});await settle();engine.scan();await settle();expect(cell.hasAttribute('data-xpf-hidden')).toBe(false);expect(replies).toHaveLength(2);
 replies[1]({scores:[.1]});await settle();expect(cell.hasAttribute('data-xpf-hidden')).toBe(false);
});
it.each(['/home','/i/lists/123','/search?q=keyword&f=live','/search?q=keyword','/doraTeX','/doraTeX/status/123'])('%sのタイムラインで本文のキーワードを非表示にする',async(path)=>{history.replaceState({},'',path);const cell=fixture(),{api}=mock();engine=await start(api);expect(cell.hasAttribute('data-xpf-hidden')).toBe(true);expect(engine.snapshot().summary.keyword).toBe(1);});
it('チップクリックは設定を開き、ホバーメニューは条件タグだけにする',async()=>{fixture();const {api}=mock();engine=await start(api);(engine.root.querySelector('#badge') as HTMLButtonElement).click();await settle();expect(api.call.mock.calls.some(c=>c[0]==='OPEN')).toBe(true);expect(engine.root.querySelector('#actions')).toBeNull();expect(engine.root.querySelector('#words')!.querySelectorAll('button')).toHaveLength(1);});
it('問い合わせ中は回転矢印と進捗を表示し、完了すると消す',async()=>{fixture('本文');let resolve:any;const {api,state}=mock([],true,()=>new Promise(r=>resolve=r));state.settings.aiShowProgress=true;engine=await start(api);await settle();expect((engine.root.querySelector('#busy') as HTMLElement).hidden).toBe(false);expect((engine.root.querySelector('#progress') as HTMLElement).hidden).toBe(false);resolve({scores:[.9],attempted:true,usage:{input_tokens:12,output_tokens:1}});await settle();expect((engine.root.querySelector('#busy') as HTMLElement).hidden).toBe(true);expect(engine.snapshot().stats).toMatchObject({requests:1,success:1,input:12,output:1});});
it('キャッシュ再利用では問い合わせ・トークン数を加算しない',async()=>{fixture('本文');const {api}=mock([],true,async()=>({scores:[.1],cached:true,usage:{input_tokens:100,output_tokens:10}}));engine=await start(api);await settle();expect(engine.snapshot().stats).toMatchObject({requests:0,input:0,output:0});expect(engine.snapshot().summary.prior).toBe(1);});
it('一時解除したタグは同じDOMを保持し、キーボードフォーカスを失わない',async()=>{fixture();const {api}=mock();engine=await start(api);const tag=engine.root.querySelector('.word') as HTMLButtonElement;tag.focus();tag.click();expect(engine.root.querySelector('.word')).toBe(tag);expect(tag.getAttribute('aria-pressed')).toBe('true');expect(engine.root.activeElement).toBe(tag);});
it('同じ/home内でおすすめからリストへ切り替えたときもページ集計と一時解除をリセットする',async()=>{history.replaceState({},'','/home');const cell=fixture();document.body.insertAdjacentHTML('afterbegin','<main><div role="tablist"><button role="tab" aria-selected="true">おすすめ</button><button role="tab" aria-selected="false">TeX</button></div></main>');const {api}=mock();engine=await start(api);const first=engine.snapshot().page;(engine.root.querySelector('.word') as HTMLButtonElement).click();expect(cell.hasAttribute('data-xpf-hidden')).toBe(false);const tabs=document.querySelectorAll('[role="tab"]');tabs[0].setAttribute('aria-selected','false');tabs[1].setAttribute('aria-selected','true');engine.scan();expect(engine.snapshot().page).not.toBe(first);expect(cell.hasAttribute('data-xpf-hidden')).toBe(true);});
it('AIを使わない行の利用AIを設定中のJevで埋めない',async()=>{fixture();const {api}=mock();engine=await start(api);expect(engine.snapshot().rows[0]).toMatchObject({provider:'',model:'',keyword:true});document.querySelector('[data-testid="tweetText"]')!.textContent='一般のポスト';engine.scan();expect(engine.snapshot().rows.at(-1)).toMatchObject({provider:'',model:'',keyword:false});});
it('API上限後もキャッシュのある別ポストを利用でき、上限対象を繰り返し送らない',async()=>{fixture('上限対象');document.body.insertAdjacentHTML('beforeend','<article role="article"><a href="/a/status/789"><time>今</time></a><div data-testid="tweetText">保存済み</div></article>');const {api,state}=mock([],true);state.settings.aiRequestLimit=1;api.call.mockImplementation(async(type:string,...args:any[])=>type==='GET'?structuredClone(state):type==='DECIDE'?(args[0]?.post.id==='123'?{limited:true}:{scores:[.9],cached:true,provider:'jev'}):undefined);engine=await start(api);await settle();expect(engine.snapshot().summary.prior).toBe(1);const calls=api.call.mock.calls.filter(c=>c[0]==='DECIDE').length;engine.scan();await settle();expect(api.call.mock.calls.filter(c=>c[0]==='DECIDE')).toHaveLength(calls);});
it('拡張無効化後は定期取得・DOM監視・スクロール処理を止め、既存の非表示を保つ',async()=>{
 vi.useFakeTimers();const cell=fixture(),{api}=mock();let alive=true,notify:()=>void=()=>{};const unlisten=vi.fn();Object.assign(api,{isConnected:()=>alive,onDisconnected:(fn:()=>void)=>{notify=fn;return vi.fn();},listen:()=>unlisten});
 try{engine=await start(api);await settle();alive=false;notify();const calls=api.call.mock.calls.length;document.body.insertAdjacentHTML('beforeend','<article role="article"><div data-testid="tweetText">セール</div></article>');window.dispatchEvent(new Event('scroll'));engine.scan();await engine.refresh();await vi.advanceTimersByTimeAsync(15000);
 expect(api.call).toHaveBeenCalledTimes(calls);expect(unlisten).toHaveBeenCalledTimes(1);expect(cell.hasAttribute('data-xpf-hidden')).toBe(true);expect(engine.root.querySelector('#badge')?.textContent).toBe('ページを再読み込み');expect((engine.root.querySelector('.word') as HTMLButtonElement).disabled).toBe(true);expect((engine.root.querySelector('#busy') as HTMLElement).hidden).toBe(true);
 }finally{engine?.dispose();engine=undefined;vi.useRealTimers();}
});
it('問い合わせ中に拡張が無効化されても、finallyから監視処理を再開しない',async()=>{
 vi.useFakeTimers();fixture('本文');let reject:any;const {api}=mock([],true,()=>new Promise((_resolve,r)=>reject=r));
 try{engine=await start(api);await settle();reject(Object.assign(Error('Extension context invalidated.'),{kind:'disconnected'}));await settle();const calls=api.call.mock.calls.length;await vi.advanceTimersByTimeAsync(15000);expect(api.call).toHaveBeenCalledTimes(calls);expect(engine.root.querySelector('#badge')?.textContent).toBe('ページを再読み込み');
 }finally{engine?.dispose();engine=undefined;vi.useRealTimers();}
});
