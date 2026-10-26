import {it,expect,vi,afterEach} from 'vitest';
import {mountDashboard} from '../src/dashboard/ui';
import {defaults,validate} from '../src/shared/settings';
let dashboard:Awaited<ReturnType<typeof mountDashboard>>|undefined;
afterEach(()=>{dashboard?.dispose();dashboard=undefined;document.body.replaceChildren();vi.restoreAllMocks();});
async function setup(){
 let state:any={settings:{...defaults,aiEnabled:true},local:{provider:'jev',profiles:{jev:{key:'saved-jev'},openai:{key:'saved-openai'},clef:{key:'saved-clef',accountId:'a'.repeat(32),model:'clef'}}},history:[],ai:{ready:true,stopped:false,blockedUntil:0}};
 const api={call:vi.fn(async(type:string,data?:any)=>{if(type==='SAVE'){state={...state,settings:validate(data.settings),local:structuredClone(data.local)};}if(type==='PERMISSION')return true;return structuredClone(state);})};
 const root=document.createElement('div');document.body.append(root);dashboard=await mountDashboard(root,api);return {root,api};
}
function click(root:HTMLElement,label:string){const button=Array.from(root.querySelectorAll('button')).find(b=>b.textContent===label);if(!button)throw Error(label);button.click();}
it('接続先変更で保存済みの他社キーを混ぜず、非表示条件を保持する',async()=>{
 const {root,api}=await setup();const words=root.querySelector('textarea')!;words.value='キーワード';words.dispatchEvent(new Event('input',{bubbles:true}));
 const provider=root.querySelector('[aria-label="利用するAI"]') as HTMLSelectElement;provider.value='clef';provider.dispatchEvent(new Event('change',{bubbles:true}));await dashboard!.save();
 const saved=api.call.mock.calls.filter(c=>c[0]==='SAVE').at(-1)![1];expect(saved.settings.rows).toEqual(['キーワード']);expect(saved.local.provider).toBe('clef');expect(saved.local.profiles.jev.key).toBe('saved-jev');expect(saved.local.profiles.clef.key).toBe('saved-clef');
 expect((root.querySelector('[aria-label="Cloudflare APIトークン"]') as HTMLInputElement).value).toBe('');
});
it('キャッシュ消去の確認でキャンセルし、承認時だけ消去する',async()=>{
 const {root,api}=await setup();const confirm=vi.spyOn(window,'confirm').mockReturnValue(false);click(root,'判定キャッシュを消去');await Promise.resolve();expect(api.call.mock.calls.some(c=>c[0]==='CLEAR')).toBe(false);
 confirm.mockReturnValue(true);click(root,'判定キャッシュを消去');await vi.waitFor(()=>expect(api.call.mock.calls.some(c=>c[0]==='CLEAR')).toBe(true));expect(root.textContent).toContain('判定キャッシュを消去しました。');
});
it('設定JSONには認証情報を含めず、通常設定だけを保存する',()=>{const settings=validate({...defaults,local:{key:'secret'},key:'secret',rows:['語']});expect(JSON.stringify(settings)).not.toContain('secret');expect(settings.rows).toEqual(['語']);});
it('APIキーを削除したときだけ対象プロファイルのキーを空にする',async()=>{const {root,api}=await setup();vi.spyOn(window,'confirm').mockReturnValue(true);click(root,'APIキーを削除');await vi.waitFor(()=>expect(api.call.mock.calls.some(c=>c[0]==='SAVE')).toBe(true));const saved=api.call.mock.calls.find(c=>c[0]==='SAVE')![1];expect(saved.local.profiles.jev.key).toBe('');expect(saved.local.profiles.openai.key).toBe('saved-openai');});
it('保存応答を待つ間に入力した新しいAPIキーを消さない',async()=>{
 let state:any={settings:{...defaults},local:{provider:'jev',profiles:{}},ai:{ready:false},history:[]},resolve:any;
 const api={call:vi.fn(async(type:string,data?:any)=>{if(type==='SAVE'){const next={...state,settings:data.settings,local:structuredClone(data.local)};return new Promise(r=>resolve=()=>{state=next;r(structuredClone(state));});}return structuredClone(state);})};
 const root=document.createElement('div');document.body.append(root);dashboard=await mountDashboard(root,api);
 const key=root.querySelector('input[type="password"]') as HTMLInputElement;key.value='first-key';const saving=dashboard.save();await vi.waitFor(()=>expect(resolve).toBeTruthy());
 key.value='second-key';key.dispatchEvent(new Event('input',{bubbles:true}));resolve();await saving;expect(key.value).toBe('second-key');
 const nextSaving=dashboard.save();await Promise.resolve();await Promise.resolve();resolve();await nextSaving;
 expect(api.call.mock.calls.filter(c=>c[0]==='SAVE').at(-1)![1].local.profiles.jev.key).toBe('second-key');
});
it('未設定ならAIがOFFでもブロック全体と状況欄をエラー表示にする',async()=>{
 const state:any={settings:{...defaults},local:{provider:'jev',profiles:{}},history:[],ai:{ready:false,configured:false,permitted:false,stopped:false}};const root=document.createElement('div');document.body.append(root);dashboard=await mountDashboard(root,{call:async()=>structuredClone(state)});
 expect(root.querySelector('.ai-section')!.classList.contains('unavailable')).toBe(true);expect(root.querySelector('.notice')!.getAttribute('role')).toBe('alert');expect(root.textContent).toContain('利用AIが未設定のため機能しません');expect(root.textContent).not.toContain('ポスト本文で非除外判定');
});
it('無効なキーの全体エラーを上部と状況欄に表示する',async()=>{const state:any={settings:{...defaults,aiEnabled:true},local:{provider:'jev',profiles:{jev:{key:'invalid'}}},ai:{ready:true,stopped:true,message:'HTTP 401',advice:'キーを入力し直してください。'},history:[]};const root=document.createElement('div');document.body.append(root);dashboard=await mountDashboard(root,{call:async()=>structuredClone(state)});expect(root.querySelector('.ai-section.unavailable')).not.toBeNull();expect(root.querySelector('.error-notice')!.textContent).toContain('HTTP 401');expect(root.querySelector('.error-notice')!.textContent).toContain('キーを入力し直してください。');});
it('重複整理は行ごとのcaseとrateを保ち、元に戻せる',async()=>{const {root}=await setup();const area=root.querySelector('textarea')!;area.value='ABC\nabc\nABC||case:1\nABC||rate:90';click(root,'重複を整理');expect(area.value).toBe('ABC\nABC||case:1\nABC||rate:90');click(root,'並べ替え・整理を元に戻す');expect(area.value).toBe('ABC\nabc\nABC||case:1\nABC||rate:90');});
it('英語でも同じ設定項目と操作を表示する',async()=>{document.documentElement.lang='en';try{const {root}=await setup();expect(root.textContent).toContain('AI exclusion classification');expect(root.textContent).toContain('Restore from history');expect(root.textContent).not.toContain('本文を取得');const option=root.querySelector('[aria-label="AI provider"]') as HTMLSelectElement;option.value='openai';option.dispatchEvent(new Event('change',{bubbles:true}));await dashboard!.save();expect(root.querySelector('[aria-label="OpenAI API key"]')).not.toBeNull();}finally{document.documentElement.lang='ja';}});
