import {it,expect} from 'vitest';
import {extractPost,postContainer} from '../src/content/posts';
function make(body:string){document.body.innerHTML=`<div data-testid="cellInnerDiv"><article role="article">${body}</article></div>`;return document.querySelector('article')!;}
it('本文だけを読み、著者・ボタン・リンクカード・引用は含めない',()=>{
 const article=make('<div>著者名</div><a href="/writer/status/123"><time>1分前</time></a><div data-testid="tweetText">本日の天気<img alt="☀️">です</div><div role="link"><div data-testid="tweetText">引用された宣伝</div><a href="/other/status/99"><time>昨日</time></a></div><div data-testid="card.wrapper">記事全文の煽り</div><button>いいね1000</button>');
 expect(extractPost(article)).toMatchObject({id:'123',text:'本日の天気☀️です'});
 expect(postContainer(article)).toBe(article.parentElement);
});
it('引用だけのポストは本文がないものとして処理する',()=>{expect(extractPost(make('<div data-testid="quoteTweet"><div data-testid="tweetText">引用</div></div>'))).toBeNull();});
it('DOM使い回しと本文変更で識別情報が変わる',()=>{const a=make('<a href="/a/status/123"><time>今</time></a><div data-testid="tweetText">本文</div>');const before=extractPost(a)!;a.querySelector('a')!.href='/a/status/124';expect(extractPost(a)!.identity).not.toBe(before.identity);a.querySelector('[data-testid="tweetText"]')!.textContent='修正';expect(extractPost(a)!.text).toBe('修正');});
it('複数ポストが同じセルにあるときは単独のarticleだけを隠す',()=>{const a=make('<div data-testid="tweetText">本文</div>');a.parentElement!.append(a.cloneNode(true));expect(postContainer(a)).toBe(a);});
