import {beforeEach,afterEach,it,expect,vi} from 'vitest';
import {webcrypto} from 'node:crypto';
import {defaults,validate,SETTINGS,LOCAL,CACHE} from '../src/shared/settings';
import {newDoc,heads,encodeDoc,decodeRemote} from '../src/shared/sync';
import {SyncStore} from '../src/background/sync-store';
import {Controller} from '../src/background/controller.js';
let local:Record<string,any>,remote:Record<string,any>;
function area(data:()=>Record<string,any>){return {get:async(key:any)=>{const d=data();if(key===null)return structuredClone(d);const keys=typeof key==='string'?[key]:key;return structuredClone(Object.fromEntries(keys.filter((k:string)=>k in d).map((k:string)=>[k,d[k]])));},set:async(value:any)=>{Object.assign(data(),structuredClone(value));},remove:async(keys:string[])=>{for(const key of keys)delete data()[key];}};}
beforeEach(()=>{local={};remote={};vi.stubGlobal('crypto',webcrypto);vi.stubGlobal('chrome',{storage:{local:area(()=>local),sync:area(()=>remote)}});});afterEach(()=>vi.unstubAllGlobals());
const settings=(word:string)=>validate({...defaults,rows:[word]});
it('同時編集を自動上書きせず、明示選択後に時計を統合する',async()=>{const store=new SyncStore();local[SETTINGS]=settings('local');await store.recordLocal(local[SETTINGS]);await store.setEnabled(true);remote=await encodeDoc(newDoc(settings('remote'),'other',[]),'other');await store.reconcile();const state=await store.state();expect(state.conflicts).toHaveLength(2);expect(local[SETTINGS].rows).toEqual(['local']);await store.resolve(state.conflicts.find(d=>d.settings.rows[0]==='remote'));expect(local[SETTINGS].rows).toEqual(['remote']);expect(heads(await decodeRemote(remote))).toHaveLength(1);});
it('同期に認証情報・キャッシュを含めず、停止中は送信しない',async()=>{local[LOCAL]={key:'secret'};local[CACHE]={text:'secret'};local[SETTINGS]=settings('test');const store=new SyncStore();await store.recordLocal(local[SETTINGS]);await store.reconcile();expect(remote).toEqual({});await store.setEnabled(true);await store.reconcile();expect(JSON.stringify(remote)).not.toContain('secret');expect((await decodeRemote(remote))[0].settings.rows).toEqual(['test']);});
it('破損したリモートを検出したときはローカルと再送予定を保持する',async()=>{local[SETTINGS]=settings('keep');const store=new SyncStore();await store.recordLocal(local[SETTINGS]);await store.setEnabled(true);remote={'xpf:other:meta':{count:1,hash:'bad'}};await store.reconcile();expect(local[SETTINGS].rows).toEqual(['keep']);expect((await store.state()).pending).toBe(true);expect(Object.keys(remote)).toHaveLength(1);});
it('送信失敗後も設定を保持して再送できる',async()=>{local[SETTINGS]=settings('new');const store=new SyncStore();await store.recordLocal(local[SETTINGS]);await store.setEnabled(true);const send=vi.spyOn(chrome.storage.sync,'set').mockRejectedValueOnce(Error('network'));await store.reconcile();expect((await store.state()).pending).toBe(true);send.mockRestore();await store.reconcile();expect((await decodeRemote(remote))[0].settings.rows).toEqual(['new']);});
it('送信失敗時も永続アラームを残し、同期をOFFにすると解除する',async()=>{
 const alarms=new Map();const api={get:vi.fn(async(name:string)=>alarms.get(name)),create:vi.fn(async(name:string,value:any)=>{alarms.set(name,value);}),clear:vi.fn(async(name:string)=>alarms.delete(name))};
 Object.assign(chrome,{alarms:api});local[SETTINGS]=settings('new');const store=new SyncStore();await store.recordLocal(local[SETTINGS]);await store.setEnabled(true);
 vi.spyOn(chrome.storage.sync,'set').mockRejectedValueOnce(Error('network'));await store.reconcile();
 expect((await store.state()).pending).toBe(true);expect(alarms.get('xpf-sync')).toMatchObject({periodInMinutes:5});
 await store.reconcile();expect((await store.state()).pending).toBe(false);expect(api.create).toHaveBeenCalledTimes(1);
 await store.setEnabled(false);await store.reconcile();expect(alarms.size).toBe(0);
});
it('同期書き込みと設定編集を直列化し、古い画面の編集で同期結果を上書きしない',async()=>{
 local[SETTINGS]=settings('before');const controller=new Controller(chrome.storage.local,vi.fn(),{contains:async()=>false});
 const store=new SyncStore(fn=>controller.settingsTransaction(fn));await store.queue(async()=>{await store.recordLocal(local[SETTINGS]);await store.setEnabled(true);await store.reconcile();});
 const baseline=await controller.state(true);if(!('local' in baseline))throw Error('admin');
 const parent=(await store.state()).doc!;remote=await encodeDoc(newDoc(settings('synced'),'other',[parent]),'other');
 const read=chrome.storage.sync.get;let release!:()=>void;
 vi.spyOn(chrome.storage.sync,'get').mockImplementationOnce(async key=>{await new Promise<void>(r=>release=r);return read(key as any);});
 const syncing=store.queue(()=>store.reconcile());await vi.waitFor(()=>expect(release).toBeTruthy());
 const saved=controller.save(settings('editor'),baseline.local,JSON.stringify({settings:baseline.settings,local:baseline.local}));
 const outcome=expect(saved).rejects.toThrow('別の画面');release();await syncing;await outcome;
 expect(local[SETTINGS].rows).toEqual(['synced']);
});
it('編集と同期用の変更記録を同じ保存操作に含め、並行した同期で編集を失わない',async()=>{
 local[SETTINGS]=settings('before');const controller=new Controller(chrome.storage.local,vi.fn(),{contains:async()=>false});
 const store=new SyncStore(fn=>controller.settingsTransaction(fn));await store.queue(async()=>{await store.recordLocal(local[SETTINGS]);await store.setEnabled(true);await store.reconcile();});
 const parent=(await store.state()).doc!;remote=await encodeDoc(newDoc(settings('remote'),'other',[parent]),'other');
 await Promise.all([controller.save(settings('edited'),{},undefined,'editor-save',next=>store.recordLocal(next)),store.queue(()=>store.reconcile())]);
 expect(local[SETTINGS].rows).toEqual(['edited']);expect((await store.state()).conflicts).toHaveLength(2);
});
