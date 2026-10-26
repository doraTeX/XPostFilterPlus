# XPostFilterPlus privacy policy

The extension reads displayed post text and post identifiers to track posts on X. Keyword matching takes place on your device.

When AI classification is enabled, post text and your classification conditions are sent to the selected provider: TypeSafe AI, OpenAI, or Cloudflare. Text includes any names or URLs present in the post. Requests use the API key or token you supplied for that provider. Provider terms govern their handling, retention, and fees.

The extension does not send data to developer-operated servers, advertising services, or analytics services.

Keywords, AI conditions, provider settings, API keys, up to 10 previous settings, and decision caches are stored in Chrome's local extension storage. If you enable Chrome sync, keywords, classification conditions, and display settings are also stored in Chrome sync for your Google account. API keys and caches are excluded from sync, JSON exports, and settings history.

API keys remain in the background and trusted extension settings page; they are not returned to X content scripts. Decision caches contain hashes of inputs and decision scores rather than post text. Cache entries are valid for 7 days, with up to 2,000 entries and a storage limit of approximately 2 MB. Temporary failure records expire after 10 minutes.

Decision details shown in a separate extension tab are held temporarily in extension session storage and removed when loaded. They can include post text. Console logging and TSV copying occur only when enabled or requested in settings.

Use **Delete API key** to remove a provider's key or **Clear decision cache** to clear decisions. Uninstalling the extension removes its local settings and credentials.
