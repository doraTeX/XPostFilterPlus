# XPostFilterPlus privacy policy

The extension reads displayed post text, post identifiers, and author account handles to track posts on X. Author handles are used for profile links in decision reports and are not added to AI requests. Keyword matching takes place on your device.

When AI classification is enabled, post text and your classification conditions are sent to the selected provider: TypeSafe AI, OpenAI, or Cloudflare. Text includes any names or URLs present in the post. Requests use the API key or token you supplied for that provider. Provider terms govern their handling, retention, and fees.

The extension does not send data to developer-operated servers, advertising services, or analytics services.

Keywords, AI conditions, provider settings, API keys, up to 10 previous settings, and decision caches are stored in Chrome's local extension storage. Chrome sync is on by default when no sync preference has been saved; existing on/off preferences are preserved. While enabled, keywords, classification conditions, and display settings are also stored in Chrome sync for your Google account. You can turn it off in the extension settings. API keys and caches are excluded from sync, JSON exports, and settings history.

API keys remain in the background and trusted extension settings frame in the dialog (or the standalone options page); they are not returned to X content scripts. Decision caches contain hashes of inputs and decision scores rather than post text. Cache entries are valid for 7 days, with up to 2,000 entries and a storage limit of approximately 2 MB. Temporary failure records expire after 10 minutes.

Continuous Console output is controlled per X tab through `chrome.storage.session`. It survives a reload of the same tab, is cleared when that tab closes or the browser session ends, and starts off in new tabs. It is excluded from Chrome sync, settings history, and settings JSON.

Decision details shown in a separate extension tab are held temporarily in extension session storage. The latest five reports (up to 6 MB in total) remain available for reloading during the browser session; older reports are removed as new reports are opened. They can include post text, the text used for AI classification, and tab-local processing and display-change logs. Console logging and TSV copying occur only when enabled or requested in settings.

## Permissions

| Permission | Purpose |
| --- | --- |
| `storage` | Store keywords, AI conditions, display settings, provider configuration, credentials, decision caches, and settings history. Use Chrome sync for settings only when enabled. Credentials, provider configuration, and caches are not synced. |
| `alarms` | Retry failed Chrome sync writes and check settings periodically while sync is enabled. The alarm can wake the extension's service worker to resume this work. |
| `https://x.com/*`, `https://twitter.com/*` | Read displayed posts, apply filtering, and show the count chip and settings controls on these sites. |
| `https://api.typesafe.ai/*` (optional) | Send post text and classification conditions to Jev and receive decisions, after the user grants connection permission. |
| `https://api.openai.com/*` (optional) | Send post text and classification conditions to OpenAI Decisions and receive decisions, after the user grants connection permission. |
| `https://api.cloudflare.com/*` (optional) | Send post text and classification conditions to Cloudflare Clef and receive decisions, after the user grants connection permission. |

All executable JavaScript is bundled with the extension. AI responses are processed as JSON data; they are not executed as code.

Use **Delete API key** to remove a provider's key or **Clear decision cache** to clear decisions. Uninstalling the extension removes its local settings and credentials.
