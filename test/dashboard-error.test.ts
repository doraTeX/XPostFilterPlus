import {afterEach,it,expect,vi} from 'vitest';
import {renderSettingsError} from '../src/dashboard/error';
afterEach(()=>{document.body.replaceChildren();document.documentElement.lang='ja';});
it.each(['en','ja'])('%sの初期読み込みエラーに閉じる操作を表示する',async lang=>{
 document.documentElement.lang=lang;const root=document.createElement('main');document.body.append(root);const close=vi.fn(async()=>{});
 renderSettingsError(root,Error('<invalid token>'),close);
 expect(root.querySelector('[role=alert]')!.textContent).toBe('<invalid token>');expect(root.querySelector('invalid')).toBeNull();
 const button=root.querySelector('button')!;expect(button.textContent).toBe(lang==='en'?'Close':'閉じる');expect(document.activeElement).toBe(button);
 button.click();await Promise.resolve();expect(close).toHaveBeenCalledTimes(1);
});
