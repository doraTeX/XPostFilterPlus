import {t} from "./i18n";
import {normalize as originalNormalize,parseRows as originalParseRows,shouldHide,cleanRows as originalCleanRows} from './keyword-rules.js';
export const SETTINGS='xpf_settings_v1',LOCAL='xpf_local_v1',CACHE='xpf_cache_v1',HISTORY='xpf_history_v1';
export const defaults={version:1,enabled:true,rows:[] as string[],ignoreCase:true,normalizeText:true,ignoreSeparators:false,legacyRate:false,aiEnabled:false,aiConditions:[] as string[],aiThreshold:.8,aiConcurrency:5,aiRequestLimit:200,aiShowProgress:false,showPageChip:true};
export type Settings=typeof defaults;
export function validate(raw:unknown):Settings{
 if(!raw||typeof raw!=='object'||Array.isArray(raw))throw Error(t("m_fd2d92074e2c"));
 const value=raw as Record<string,unknown>,out={...defaults};
 if(value.version!==1)throw Error(t("m_7783068ec643"));
 for(const key of ['enabled','ignoreCase','normalizeText','ignoreSeparators','aiEnabled','aiShowProgress','showPageChip','legacyRate'] as const){if(value[key]!==undefined){if(typeof value[key]!=='boolean')throw Error(t("m_8a2442373524"));out[key]=value[key];}}
 for(const key of ['rows','aiConditions'] as const){if(value[key]!==undefined){if(!Array.isArray(value[key])||value[key].some(x=>typeof x!=='string'))throw Error(t("m_80ef516659cb"));const rows=(value[key] as string[]).map(x=>x.trim()).filter(Boolean);out[key]=key==='rows'?rows:[...new Set(rows)];}}
 if(out.rows.length>3000||out.aiConditions.length>64||[...out.rows,...out.aiConditions].some(x=>x.length>500))throw Error(t("m_ace6732b5316"));
 for(const [key,min,max]of [['aiThreshold',.5,1],['aiConcurrency',1,20],['aiRequestLimit',1,10000]] as const){if(value[key]!==undefined){const n=value[key];if(typeof n!=='number'||!Number.isFinite(n)||n<min||n>max||(key!=='aiThreshold'&&!Number.isInteger(n)))throw Error(t("m_5a684cb52d11"));out[key]=n;}}
 parseRows(out.rows,out);return out;
}
function originalConfig(c:Settings){return {...c,normalization:c.normalizeText?'loose':'legacy'};}
export function normalize(text:string,c:Settings,sensitive=!c.ignoreCase){return originalNormalize(text,originalConfig(c),sensitive);}
export function parseRows(rows:string[],c:Settings){return originalParseRows(rows,originalConfig(c));}
export function cleanRows(rows:string[],c:Settings){return originalCleanRows(rows,originalConfig(c));}
export {shouldHide};
