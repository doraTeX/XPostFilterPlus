import {afterEach,it,expect} from 'vitest';
import {createOverlay} from '../src/content/overlay';
let overlay:ReturnType<typeof createOverlay>|undefined;
afterEach(()=>{overlay?.dispose();overlay=undefined;document.body.replaceChildren();});
function setup(){
 overlay=createOverlay({open:()=>{},pause:()=>{},release:()=>{}});
 const data={count:1,enabled:true,paused:false,show:true,running:false,showProgress:false,progress:'',error:'',words:[['keyword: test',1]] as [string,number][],released:new Set<string>()};overlay.update(data);
 return {overlay,data,wrap:overlay.root.querySelector('#wrap')!,badge:overlay.root.querySelector<HTMLButtonElement>('#badge')!,tip:overlay.root.querySelector<HTMLElement>('#tip')!,pause:overlay.root.querySelector<HTMLElement>('[data-pause-control]')!};
}
it('設定の閉じ処理中と直後のホバー・フォーカス・描画更新でタグを一瞬も再表示しない',()=>{
 const ui=setup();ui.wrap.dispatchEvent(new Event('mouseenter'));ui.badge.focus();expect(ui.tip.style.display).toBe('block');
 ui.overlay.setSettingsOpen(true);
 const hidden=()=>{expect(ui.tip.style.display).toBe('none');expect(ui.pause.hidden).toBe(true);};hidden();
 for(const visible of [true,false]){
  ui.overlay.setSettingsOpen(visible);hidden();ui.badge.focus();hidden();ui.wrap.dispatchEvent(new Event('mouseenter'));hidden();ui.overlay.update(ui.data);hidden();ui.badge.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,composed:true}));hidden();
 }
 document.body.dispatchEvent(new MouseEvent('pointermove',{bubbles:true,composed:true}));hidden();ui.wrap.dispatchEvent(new Event('mouseenter'));expect(ui.tip.style.display).toBe('block');
});
it('閉じた後も実際のポインター移動やTab操作では即座にタグを使える',async()=>{
 const ui=setup();ui.overlay.setSettingsOpen(true);ui.overlay.setSettingsOpen(false);const move=new MouseEvent('pointermove',{bubbles:true,composed:true});Object.defineProperty(move,'movementX',{value:3});ui.badge.dispatchEvent(move);expect(ui.tip.style.display).toBe('block');
 ui.overlay.setSettingsOpen(true);ui.overlay.setSettingsOpen(false);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));ui.badge.focus();await Promise.resolve();expect(ui.tip.style.display).toBe('block');expect(ui.pause.hidden).toBe(false);
});
it('設定表示中はポインター移動・Tab・通常更新でもタグを開かない',async()=>{
 const ui=setup();ui.overlay.setSettingsOpen(true);document.dispatchEvent(new KeyboardEvent('keydown',{key:'Tab',bubbles:true}));ui.badge.focus();ui.wrap.dispatchEvent(new Event('mouseenter'));ui.overlay.update(ui.data);await Promise.resolve();expect(ui.tip.style.display).toBe('none');expect(ui.pause.hidden).toBe(true);
});
