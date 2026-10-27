import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {observeSettings} from '../src/dashboard/settings-events';
import {SETTINGS,LOCAL} from '../src/shared/settings';
beforeEach(()=>vi.useFakeTimers());
afterEach(()=>{vi.clearAllTimers();vi.useRealTimers();vi.unstubAllGlobals();});
it.each(['absent','no-storage','no-event','invalidated'])('storage APIを参照できなくても定期確認へ切り替え、終了時に止める（%s）',async state=>{
 const chromeAPI=state==='absent'?undefined:state==='no-storage'?{}:state==='no-event'?{storage:{}}:{get storage(){throw Error('Extension context invalidated.');}};
 vi.stubGlobal('chrome',chromeAPI);const refresh=vi.fn(),stop=observeSettings(refresh);
 await vi.advanceTimersByTimeAsync(3000);expect(refresh).toHaveBeenCalledTimes(2);stop();await vi.advanceTimersByTimeAsync(3000);expect(refresh).toHaveBeenCalledTimes(2);
});
it('通知登録自体の失敗でも定期確認を続ける',async()=>{
 vi.stubGlobal('chrome',{storage:{onChanged:{addListener(){throw Error('API unavailable');}}}});const refresh=vi.fn(),stop=observeSettings(refresh);
 await vi.advanceTimersByTimeAsync(1500);expect(refresh).toHaveBeenCalledTimes(1);stop();
});
it('通常は関連するlocal設定の変更だけ通知し、余分な定期取得を行わない',async()=>{
 const addListener=vi.fn(),removeListener=vi.fn();vi.stubGlobal('chrome',{storage:{onChanged:{addListener,removeListener}}});const refresh=vi.fn(),stop=observeSettings(refresh),listener=addListener.mock.calls[0][0];
 listener({other:{}},'local');listener({[SETTINGS]:{}},'sync');expect(refresh).not.toHaveBeenCalled();
 for(const key of [SETTINGS,LOCAL,'xpf_sync_state'])listener({[key]:{}},'local');expect(refresh).toHaveBeenCalledTimes(3);
 await vi.advanceTimersByTimeAsync(5000);expect(refresh).toHaveBeenCalledTimes(3);
 vi.stubGlobal('chrome',{});stop();expect(removeListener).toHaveBeenCalledWith(listener);
});
it('拡張リロード後の通知解除が例外でも画面を閉じられる',()=>{
 vi.stubGlobal('chrome',{storage:{onChanged:{addListener:vi.fn(),removeListener:()=>{throw Error('Extension context invalidated.');}}}});
 const stop=observeSettings(vi.fn());expect(()=>stop()).not.toThrow();
});
