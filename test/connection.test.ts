import {beforeEach,afterEach,it,expect,vi} from 'vitest';
beforeEach(()=>{vi.resetModules();document.getElementById('xpf-reload-notice')?.remove();});
afterEach(()=>{vi.unstubAllGlobals();vi.restoreAllMocks();document.getElementById('xpf-reload-notice')?.remove();});
it.each(['ja','en'])('%sの翻訳は拡張API無効化後も最後のUI言語を保持し、例外を出さない',async(locale)=>{
 const getUILanguage=vi.fn().mockReturnValue(locale),getMessage=vi.fn().mockReturnValue('');vi.stubGlobal('chrome',{i18n:{getUILanguage,getMessage}});
 const {t}=await import('../src/shared/i18n');expect(t('hiddenCount',[3])).toBe(locale==='ja'?'3件非表示中':'3 hidden');
 getUILanguage.mockImplementation(()=>{throw Error('Extension context invalidated.');});getMessage.mockImplementation(()=>{throw Error('Extension context invalidated.');});document.documentElement.lang=locale==='ja'?'en':'ja';
 expect(()=>t('reloadRequired')).not.toThrow();expect(t('hiddenCount',[4])).toBe(locale==='ja'?'4件非表示中':'4 hidden');const calls=getUILanguage.mock.calls.length;t('chipTitle');expect(getUILanguage.mock.calls).toHaveLength(calls);
});
it('getMessageだけが無効化された場合も同梱リソースに切り替える',async()=>{const getMessage=vi.fn(()=>{throw Error('Extension context invalidated.');});vi.stubGlobal('chrome',{i18n:{getUILanguage:()=> 'en',getMessage}});const {t}=await import('../src/shared/i18n');expect(t('reloadRequiredShort')).toBe('Reload this page');expect(t('chipTitle')).toBe('Open XPostFilterPlus settings');expect(getMessage).toHaveBeenCalledTimes(1);});
it.each([false,true])('通信中の無効化を一度だけ通知し、以後のChrome API呼び出しを止める（非同期=%s）',async(asyncFailure)=>{
 const sendMessage=vi.fn(()=>asyncFailure?Promise.reject(Error('Extension context invalidated.')):(()=>{throw Error('Extension context invalidated.');})());vi.stubGlobal('chrome',{runtime:{id:'extension',sendMessage}});
 const {call}=await import('../src/shared/client'),{onDisconnected,isConnected}=await import('../src/shared/connection'),changed=vi.fn();onDisconnected(changed);
 await expect(call('GET')).rejects.toMatchObject({kind:'disconnected',attempted:false});await expect(call('GET')).rejects.toMatchObject({kind:'disconnected'});
 expect(sendMessage).toHaveBeenCalledTimes(1);expect(changed).toHaveBeenCalledTimes(1);expect(isConnected()).toBe(false);expect(document.querySelectorAll('#xpf-reload-notice')).toHaveLength(1);
});
it('runtime.idが消えた場合は送信せず、再読み込みの案内だけを表示する',async()=>{const sendMessage=vi.fn();vi.stubGlobal('chrome',{runtime:{sendMessage}});const {call}=await import('../src/shared/client');await expect(call('GET')).rejects.toMatchObject({kind:'disconnected'});expect(sendMessage).not.toHaveBeenCalled();expect(document.getElementById('xpf-reload-notice')?.textContent).toContain('再読み込み');});
it('通常のポスト単位のAPIエラーを拡張無効化として扱わない',async()=>{vi.stubGlobal('chrome',{runtime:{id:'extension',sendMessage:vi.fn().mockResolvedValue({ok:false,error:'No answer',kind:'refusal',scope:'article'})}});const {call}=await import('../src/shared/client'),{isConnected}=await import('../src/shared/connection');await expect(call('DECIDE')).rejects.toMatchObject({kind:'refusal',scope:'article'});expect(isConnected()).toBe(true);expect(document.getElementById('xpf-reload-notice')).toBeNull();});
