import {t} from "./i18n";
// Y!News Filter Plusの照合・行指定・除外率・重複整理を流用。
function normalize(text, config, sensitive) {
  let s = String(text);
  if (config.normalization === 'legacy') {
    s = s.replace(/[Ａ-Ｚａ-ｚ０-９]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0));
  } else {
    s = s.normalize('NFKD').replace(/\p{M}/gu, c => /[\u3099\u309a]/u.test(c) ? c : '').normalize('NFC');
    s = s.replace(/[‘’‚‛]/g,"'").replace(/[“”„‟]/g,'"')
      .replace(/[‐‑‒–—−]/g,'-').replace(/[〜～]/g,'~').replace(/[・･]/g,'');
  }
  if (!sensitive) {
    s = s.toLowerCase();
    if (config.normalization !== 'legacy') s = s.replace(/ß/g,'ss').replace(/ς/g,'σ');
  }
  if (config.ignoreSeparators) s = s.replace(/[\p{P}\p{Z}\s]/gu,'');
  return s;
}
function parseRows(rows, config) {
  return rows.map((row,index)=> {
    const [word, options, ...rest] = row.split('||');
    if (rest.length || !word.trim()) throw Error(t("m_324a7eb1542b",[index+1]));
    let sensitive = !config.ignoreCase, rate = '100';
    if (options !== undefined) for (const option of options.split(',')) {
      const match = option.trim().match(/^(case|rate):(.+)$/);
      if (!match) throw Error(t("m_895f3125bb8f",[index+1]));
      if (match[1] === 'case') {
        if (!/^[01]$/.test(match[2])) throw Error(t("m_30f173600378"));
        sensitive = match[2] === '1';
      } else {
        if (!/^\d+(?:\.\d+)?!?$/.test(match[2]) || Number(match[2].replace('!',''))>100) throw Error(t("m_99a45c07d879"));
        rate = match[2];
      }
    }
    const needle = normalize(word.trim(),config,sensitive);
    if (!needle) throw Error(t("m_a5b16972a51a",[index+1]));
    return {word:word.trim(),needle, sensitive, rate, count:0};
  });
}
function shouldHide(rule, config) {
  const percent = Number(rule.rate.replace('!',''));
  if (!config.legacyRate && percent === 100) return true;
  const cycle = Math.round(100 / Math.max(1,100-percent));
  rule.count++;
  const show = rule.rate.endsWith('!') ? rule.count===1 : rule.count>=cycle;
  if (rule.count>=cycle) rule.count=0;
  return !show;
}
function cleanRows(rows, config) {
  const nonempty=rows.map(x=>x.trim()).filter(Boolean);
  const rules=parseRows(nonempty,config), seen=new Set(), result=[];
  rules.forEach((r,i)=>{
    let rate=String(Number(r.rate.replace('!','')))+(r.rate.endsWith('!')?'!':'');
    if(!config.legacyRate && Number(r.rate.replace('!',''))===100)rate='100';
    const key=JSON.stringify([r.needle,r.sensitive,rate]);
    if(!seen.has(key)){seen.add(key);result.push(nonempty[i]);}
  });
  return {rows:result,removed:nonempty.length-result.length};
}

export {normalize,parseRows,shouldHide,cleanRows};
