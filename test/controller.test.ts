import {it,expect,vi,afterEach} from 'vitest';
import {webcrypto} from 'node:crypto';
import {Controller} from '../src/background/controller.js';
import {defaults,SETTINGS,LOCAL,CACHE} from '../src/shared/settings';
import {aiError} from '../src/shared/ai-errors.js';
afterEach(()=>vi.unstubAllGlobals());
function setup(provider='jev',conditions=['宣伝']){
 vi.stubGlobal('crypto',webcrypto);
 const data:Record<string,any>={[SETTINGS]:{...defaults,aiEnabled:true,aiConditions:conditions},[LOCAL]:{provider,profiles:{jev:{key:'jev-secret'},openai:{key:'openai-secret'},clef:{key:'cf-secret',accountId:'a'.repeat(32),model:'clef'}}}};
 const store={get:async(key:string)=>structuredClone({[key]:data[key]}),set:async(value:Record<string,any>)=>{Object.assign(data,structuredClone(value));}};
 const transport=vi.fn().mockResolvedValue({status:200,text:JSON.stringify(provider==='openai'?{answers:[{name:'q0',type:'predicate',probability:.94}]}:{answers:{q0:{noul:.94}}})});
 const permissions={contains:vi.fn().mockResolvedValue(true)};
 const controller=new Controller(store,transport,permissions);
 return {controller,data,transport,permissions};
}
const post={id:'123',text:'商品を購入してください'};
it.each(['jev','openai','clef'])('%sの接続先と認証を限定し、本文と条件のみ送信する',async(provider)=>{
 const {controller,transport}=setup(provider);const result=await controller.decide(post,'page');expect(result.scores).toEqual([.94]);
 const [url,options]=transport.mock.calls[0];expect(url).toContain(provider==='jev'?'api.typesafe.ai':provider==='clef'?'api.cloudflare.com':'api.openai.com');
 expect(options.headers.Authorization).toBe('Bearer '+(provider==='jev'?'jev-secret':provider==='clef'?'cf-secret':'openai-secret'));
 const body=JSON.parse(options.body);expect(JSON.stringify(body)).not.toContain('https://x.com');expect(JSON.stringify(body)).not.toContain('123');expect(JSON.stringify(body)).toContain(post.text);
});
it('同じポストを同時に表示してもAPIを重複送信せず、次回はキャッシュを使う',async()=>{
 const {controller,transport}=setup();const results=await Promise.all([controller.decide(post,'page1'),controller.decide(post,'page2')]);expect(results[0].scores).toEqual(results[1].scores);expect(transport).toHaveBeenCalledTimes(1);
 expect((await controller.decide(post,'page3')).cached).toBe(true);expect(transport).toHaveBeenCalledTimes(1);
});
it.each(['jev','openai','clef'])('%sの記事単位の失敗は保存済み設定を停止せず、他のポストを処理する',async(provider)=>{
 const {controller,data,transport}=setup(provider);transport.mockResolvedValueOnce({status:413,text:'{}'});
 expect((await controller.decide(post,'page')).skipped).toBe('http');expect(data[LOCAL].stopped).not.toBe(true);
 await controller.decide({...post,id:'124'},'page');expect(transport).toHaveBeenCalledTimes(2);
 expect((await controller.decide(post,'page')).cached).toBe(true);expect(transport).toHaveBeenCalledTimes(2);
});
it.each(['jev','openai','clef'])('%sの回答拒否を非該当として保存しない',async(provider)=>{
 const {controller,data,transport}=setup(provider);const answers=provider==='openai'?[{name:'q0',type:'refusal'}]:{q0:{type:'refusal'}};transport.mockResolvedValueOnce({status:200,text:JSON.stringify({answers})});
 const result=await controller.decide(post,'page');expect(result.skipped).toBe('refusal');expect(result.scores).toBeUndefined();expect(data[LOCAL].failures||0).toBe(0);
});
it.each([401,402,403])('HTTP %sは全体を停止し、以後のポストを送信しない',async(status)=>{
 const {controller,data,transport}=setup();transport.mockResolvedValueOnce({status,text:'{}'});await expect(controller.decide(post,'page')).rejects.toBeTruthy();expect(data[LOCAL].stopped).toBe(true);
 expect((await controller.decide({...post,id:'999'},'page')).paused).toBe(true);expect(transport).toHaveBeenCalledTimes(1);
});
it('一時障害は全体で待機し、Cloudflare無料枠超過は全体停止する',async()=>{
 const {controller,data,transport}=setup('clef');transport.mockResolvedValueOnce({status:429,text:JSON.stringify({errors:[{code:3036}]})});await expect(controller.decide(post,'p')).rejects.toBeTruthy();expect(data[LOCAL].stopped).toBe(true);
 await controller.resume();transport.mockResolvedValueOnce({status:503,text:'{}'});await expect(controller.decide(post,'p')).rejects.toBeTruthy();expect(data[LOCAL].stopped).toBe(false);expect(data[LOCAL].blockedUntil).toBeGreaterThan(Date.now());
});
it('ブラウザの接続許可がない場合は通信せず全体の設定エラーとする',async()=>{const {controller,data,permissions,transport}=setup();permissions.contains.mockResolvedValue(false);await expect(controller.decide(post,'page')).rejects.toMatchObject({kind:'permission'});expect(transport).not.toHaveBeenCalled();expect(data[LOCAL].stopped).toBe(true);});
it('APIキーをページ用の設定応答に含めない',async()=>{const {controller}=setup();const state=await controller.state();expect(JSON.stringify(state)).not.toContain('secret');expect('local' in state).toBe(false);});
it('キャッシュ消去前の遅れた応答が結果を書き戻さない',async()=>{
 const {controller,data,transport}=setup();let resolve:any;transport.mockImplementationOnce(()=>new Promise(r=>resolve=r));const pending=controller.decide(post,'page');await vi.waitFor(()=>expect(resolve).toBeTruthy());await controller.clear();resolve({status:200,text:JSON.stringify({answers:{q0:{noul:.99}}})});expect((await pending).stale).toBe(true);expect(data[CACHE]).toEqual({});
});
it('保存は設定の競合を検出し、モデル変更でキャッシュを分ける',async()=>{
 const {controller,data,transport}=setup('clef');await controller.decide(post,'p');const old=await controller.state(true);if(!('local' in old))throw Error('admin state');const next=structuredClone(old.local);next.profiles.clef.model='clef-flash';await controller.save(old.settings,next,JSON.stringify({settings:old.settings,local:old.local}));await controller.decide(post,'p');expect(transport).toHaveBeenCalledTimes(2);
 await expect(controller.save(old.settings,old.local,JSON.stringify({settings:old.settings,local:old.local}))).rejects.toThrow('別の画面');expect(data[LOCAL].profiles.clef.model).toBe('clef-flash');
});
it('ポスト本文の変更は別キャッシュにし、キーを変更しても非表示条件を失わない',async()=>{const {controller,transport}=setup();await controller.decide(post,'p');await controller.decide({...post,text:'本文変更'},'p');expect(transport).toHaveBeenCalledTimes(2);});
it('ネットワーク障害とポスト単位のタイムアウトを分離する',async()=>{const {controller,data,transport}=setup();transport.mockRejectedValueOnce(aiError('jev','timeout'));expect((await controller.decide(post,'p')).skipped).toBe('timeout');expect(data[LOCAL].stopped).not.toBe(true);transport.mockRejectedValueOnce(aiError('jev','network'));await expect(controller.decide({...post,id:'456'},'p')).rejects.toBeTruthy();expect(data[LOCAL].blockedUntil).toBeGreaterThan(Date.now());});
it('APIキーがあっても通信許可前は利用可能と表示しない',async()=>{const {controller,permissions}=setup();permissions.contains.mockResolvedValue(false);expect((await controller.state()).ai).toMatchObject({configured:true,permitted:false,ready:false});permissions.contains.mockResolvedValue(true);expect((await controller.state()).ai.ready).toBe(true);});
it('壊れたキャッシュの値を判定結果として利用しない',async()=>{const {controller,data,transport}=setup();await controller.decide(post,'p');const key=Object.keys(data[CACHE])[0];data[CACHE][key].scores=[NaN];expect((await controller.decide(post,'p')).scores).toEqual([.94]);expect(transport).toHaveBeenCalledTimes(2);});
it('判定中のエラー状態の更新だけで、入力中の設定を競合扱いにしない',async()=>{const {controller,data}=setup();const before=await controller.state(true);if(!('local' in before))throw Error('admin');data[LOCAL].stopped=true;data[LOCAL].lastError='接続エラー';const next={...before.settings,rows:['語']};await controller.save(next,before.local,JSON.stringify({settings:before.settings,local:before.local}));expect(data[SETTINGS].rows).toEqual(['語']);expect(data[LOCAL].stopped).toBe(true);});
it('問い合わせ上限到達後も、明示的なキャッシュ消去で再判定できる',async()=>{const {controller,data,transport}=setup();data[SETTINGS].aiRequestLimit=1;await controller.decide(post,'page');expect((await controller.decide({...post,id:'999'},'page')).limited).toBe(true);await controller.clear();expect((await controller.decide(post,'page')).scores).toEqual([.94]);expect(transport).toHaveBeenCalledTimes(2);});
it('複数タブから問い合わせてもバックグラウンドで同時実行数を制限する',async()=>{
 const {controller,data,transport}=setup();data[SETTINGS].aiConcurrency=2;const replies:((v:any)=>void)[]=[];transport.mockImplementation(()=>new Promise(r=>replies.push(r)));
 const work=[1,2,3].map(n=>controller.decide({...post,id:String(n)},'tab'+n));await vi.waitFor(()=>expect(replies).toHaveLength(2));expect(transport).toHaveBeenCalledTimes(2);
 replies[0]({status:200,text:JSON.stringify({answers:{q0:{noul:.8}}})});await vi.waitFor(()=>expect(replies).toHaveLength(3));for(const reply of replies.slice(1))reply({status:200,text:JSON.stringify({answers:{q0:{noul:.8}}})});await Promise.all(work);
});
it('キー確認の最小リクエストは通常のキャッシュやポスト予算を使わない',async()=>{const {controller,data,transport}=setup();await controller.verify();expect(transport).toHaveBeenCalledTimes(1);const body=transport.mock.calls[0][1].body;expect(body).toContain('接続確認');expect(data[CACHE]).toBeUndefined();expect(data[LOCAL].connectionCheck.ok).toBe(true);expect((await controller.state()).ai.verifying).toBe(false);});
it('キー確認で401なら全体エラーを保持し、確認中のままにならない',async()=>{const {controller,data,transport}=setup();transport.mockResolvedValueOnce({status:401,text:'{}'});await controller.verify();expect(data[LOCAL].stopped).toBe(true);expect(data[LOCAL].verifying).toBe(false);expect((await controller.state()).ai.verifying).toBe(false);});
it('サービスワーカー再起動前の確認中フラグだけで判定を止めない',async()=>{const {controller,data}=setup();data[LOCAL].verifying=true;expect((await controller.state()).ai.verifying).toBe(false);expect((await controller.decide(post,'page')).scores).toEqual([.94]);});
it('連続入力の保存履歴は開始前の内容を保持し、インポートは別履歴にする',async()=>{const {controller,data}=setup();const before=await controller.settings();for(let i=0;i<5;i++)await controller.save({...before,rows:['入力'+i]},data[LOCAL]);const historyKey='xpf_history_v1';expect(data[historyKey]).toHaveLength(1);expect(data[historyKey][0].settings.rows).toEqual(before.rows);await controller.save({...before,rows:['import']},data[LOCAL],undefined,'json-import');expect(data[historyKey]).toHaveLength(2);expect(data[historyKey][0].settings.rows).toEqual(['入力4']);});
it('通信許可を直した後のキー確認は以前の停止状態を解除して実際に問い合わせる',async()=>{const {controller,data,transport}=setup();data[LOCAL].stopped=true;data[LOCAL].lastError='permission';await controller.verify();expect(transport).toHaveBeenCalledTimes(1);expect(data[LOCAL].stopped).toBe(false);expect(data[LOCAL].connectionCheck.ok).toBe(true);});
