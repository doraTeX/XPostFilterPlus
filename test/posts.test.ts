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
it('引用元ではなく投稿者本人のアカウントをパーマリンクから取得する',()=>{
 const a=make('<div role="link"><a href="/quoted/status/99"><time>昨日</time></a><div data-testid="tweetText">引用</div></div><a href="/Actual_Author/status/123"><time>今</time></a><div data-testid="tweetText">本文</div>');
 expect(extractPost(a)).toMatchObject({id:'123',author:'Actual_Author',text:'本文'});
});
it('i/web形式のリンクでも本人のUser-Nameからアカウントを取得し、不明なら空欄にする',()=>{
 const a=make('<div data-testid="User-Name"><a href="/actual">投稿者</a></div><a href="/i/web/status/123"><time>今</time></a><div data-testid="tweetText">本文</div>');
 expect(extractPost(a)!.author).toBe('actual');a.querySelector('[data-testid="User-Name"] a')!.setAttribute('href','https://evil.example/actual');expect(extractPost(a)!.author).toBe('');
});
