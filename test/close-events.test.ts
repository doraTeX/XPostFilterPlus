import {it,expect,vi} from 'vitest';
import {bindCloseEvents} from '../src/dashboard/close-events';
it.each(['input','textarea','select'])('フォーカス中の%sではEscと親からの閉じる要求を無視する',tag=>{
 const field=document.createElement(tag),close=vi.fn(async()=>{});document.body.append(field);field.focus();const dispose=bindCloseEvents(close,true);
 try{
  const event=new KeyboardEvent('keydown',{key:'Escape',cancelable:true});window.dispatchEvent(event);
  expect(event.defaultPrevented).toBe(false);expect(close).not.toHaveBeenCalled();
  window.dispatchEvent(new MessageEvent('message',{source:window,origin:'https://x.com',data:{type:'XPF_REQUEST_CLOSE'}}));expect(close).not.toHaveBeenCalled();
  field.blur();window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',cancelable:true}));expect(close).toHaveBeenCalledTimes(1);
 }finally{dispose();field.remove();}
});
it('Escで保存待ちの閉じる処理を呼び、IME変換中には閉じない',()=>{
 const close=vi.fn(async()=>{}),dispose=bindCloseEvents(close,true);
 try{window.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',isComposing:true}));expect(close).not.toHaveBeenCalled();
  const event=new KeyboardEvent('keydown',{key:'Escape',cancelable:true});window.dispatchEvent(event);expect(event.defaultPrevented).toBe(true);expect(close).toHaveBeenCalledTimes(1);
 }finally{dispose();}
});
it('親フレーム・許可した接続元・閉じるメッセージの3条件を満たすときだけ反応する',()=>{
 const close=vi.fn(async()=>{}),dispose=bindCloseEvents(close,true);
 try{
  window.dispatchEvent(new MessageEvent('message',{source:window,origin:'https://evil.example',data:{type:'XPF_REQUEST_CLOSE'}}));
  window.dispatchEvent(new MessageEvent('message',{source:null,origin:'https://x.com',data:{type:'XPF_REQUEST_CLOSE'}}));
  window.dispatchEvent(new MessageEvent('message',{source:window,origin:'https://x.com',data:{type:'other'}}));expect(close).not.toHaveBeenCalled();
  window.dispatchEvent(new MessageEvent('message',{source:window,origin:'https://x.com',data:{type:'XPF_REQUEST_CLOSE'}}));expect(close).toHaveBeenCalledTimes(1);
 }finally{dispose();}
});
