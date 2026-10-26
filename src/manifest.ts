import {defineManifest} from '@crxjs/vite-plugin';
export default defineManifest({
 manifest_version:3,name:'__MSG_extName__',version:'0.1.0',default_locale:'en',
 description:'__MSG_extDescription__',
 minimum_chrome_version:'110',
 icons:{16:'icons/icon16.png',48:'icons/icon48.png',128:'icons/icon128.png'},
 action:{default_title:'__MSG_actionTitle__'},
 options_page:'src/dashboard/index.html',
 background:{service_worker:'src/background/index.ts',type:'module'},
 content_scripts:[{matches:['https://x.com/*','https://twitter.com/*'],js:['src/content/index.ts'],run_at:'document_idle'}],
 permissions:['storage'],
 host_permissions:['https://x.com/*','https://twitter.com/*'],
 optional_host_permissions:['https://api.typesafe.ai/*','https://api.openai.com/*','https://api.cloudflare.com/*']
});
