export const ARTICLE='article[role="article"]';
function quoted(node:Element,article:Element){
 for(let p=node.parentElement;p&&p!==article;p=p.parentElement)if(p.matches('[data-testid="quoteTweet"],[data-testid="card.wrapper"],[role="link"]'))return true;
 return false;
}
function textOf(node:Element):string{return Array.from(node.childNodes).map(n=>n.nodeType===3?n.textContent||'':n instanceof Element?n.tagName==='IMG'?n.getAttribute('alt')||'':n.tagName==='BR'?'\n':textOf(n):'').join('');}
export function extractPost(article:Element){
 const texts=Array.from(article.querySelectorAll('[data-testid="tweetText"]')).filter(n=>n.closest(ARTICLE)===article&&!quoted(n,article));
 const text=texts.map(textOf).join('\n').trim();if(!text)return null;
 const links=Array.from(article.querySelectorAll('a[href*="/status/"]')).filter(a=>!quoted(a,article)&&a.closest(ARTICLE)===article);
 const link=links.find(a=>a.querySelector('time'))||links[0];
 const match=/\/status\/(\d+)/.exec(link?.getAttribute('href')||'');
 return {id:match?.[1]||'text',text,identity:JSON.stringify([match?.[1]||'',text])};
}
export function postContainer(article:Element){
 const cell=article.closest('[data-testid="cellInnerDiv"]');
 return cell&&Array.from(cell.querySelectorAll(ARTICLE)).filter(a=>!a.parentElement?.closest(ARTICLE)).length===1?cell:article;
}
