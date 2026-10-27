import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {waitForXReady} from '../src/content/startup';
let originalURL:string;
beforeEach(()=>{originalURL=location.href;vi.useFakeTimers();document.body.replaceChildren();history.replaceState(null,'','/');});
afterEach(()=>{history.replaceState(null,'',originalURL);document.body.replaceChildren();vi.clearAllTimers();vi.useRealTimers();});
it('入口にmainがあってもX自身が/homeへ移動するまでは待ち、URLもDOMも書き換えない',async()=>{
 document.body.innerHTML='<main><h1>Xへようこそ。</h1></main>';const before=document.body.innerHTML,started=vi.fn(),stop=vi.fn();
 const ready=waitForXReady(()=>true,()=>stop).then(value=>{started(value);return value;});await vi.advanceTimersByTimeAsync(2000);
 expect(started).not.toHaveBeenCalled();expect(location.pathname).toBe('/');expect(document.body.innerHTML).toBe(before);
 history.replaceState(null,'','/home');await vi.advanceTimersByTimeAsync(250);expect(await ready).toBe(true);expect(started).toHaveBeenCalledExactlyOnceWith(true);expect(stop).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it('URLだけ遷移しても、Xのmainが組み立つまでは待つ',async()=>{
 history.replaceState(null,'','/home');const started=vi.fn(),ready=waitForXReady(()=>true,()=>{}).then(started);
 await vi.advanceTimersByTimeAsync(1000);expect(started).not.toHaveBeenCalled();document.body.innerHTML='<main></main>';await vi.advanceTimersByTimeAsync(250);await ready;expect(started).toHaveBeenCalledExactlyOnceWith(true);
});
it.each(['/home','/search?q=test','/i/lists/123','/writer','/writer/status/123'])('%sはポストが0件でもmainがあれば起動できる',async path=>{
 history.replaceState(null,'',path);document.body.innerHTML='<main><p>まだポストはありません</p></main>';const listen=vi.fn();expect(await waitForXReady(()=>true,listen)).toBe(true);expect(listen).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
it('接続切れ通知で待機を解除し、監視とタイマーを残さない',async()=>{
 let disconnected!:()=>void;const stop=vi.fn(),ready=waitForXReady(()=>true,listener=>{disconnected=listener;return stop;});disconnected();expect(await ready).toBe(false);expect(stop).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it('切断通知が登録中に同期的に来ても監視を解除する',async()=>{
 const stop=vi.fn();expect(await waitForXReady(()=>true,listener=>{listener();return stop;})).toBe(false);expect(stop).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it('接続確認で無効化を検知した場合も待機を止める',async()=>{
 let connected=true;const stop=vi.fn(),ready=waitForXReady(()=>connected,()=>stop);connected=false;await vi.advanceTimersByTimeAsync(250);expect(await ready).toBe(false);expect(stop).toHaveBeenCalledTimes(1);expect(vi.getTimerCount()).toBe(0);
});
it('起動時点ですでに切断されていれば待機を作らない',async()=>{
 const listen=vi.fn();expect(await waitForXReady(()=>false,listen)).toBe(false);expect(listen).not.toHaveBeenCalled();expect(vi.getTimerCount()).toBe(0);
});
