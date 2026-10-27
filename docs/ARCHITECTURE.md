# Architecture

The project is independent of Y!News Filter Plus and reuses its relevant behavior and styles.

- `src/content/posts.ts` extracts a post's own text, excluding quotes, link cards, author names, and action controls. Emoji alt text is preserved.
- `src/content/engine.js` tracks posts, handles DOM reuse and view changes, applies filters, queues nearby posts for classification, and supplies per-tab usage and decision records.
- `src/content/overlay.ts` ports the original count chip, condition tags, temporary overrides, progress tooltip, rotating arrow, and error indicator. Existing tag elements retain keyboard focus.
- `src/shared/keyword-rules.js` reuses normalization, per-line options, exclusion rates, and duplicate cleanup from Y!News Filter Plus.
- `src/background/controller.js` owns credentials, provider requests, concurrency, deduplication, budgets, caches, key verification, and provider-wide failure state.
- `src/shared/sync.ts` and `src/background/sync-store.ts` reuse vector clocks, chunked storage, integrity checks, and explicit conflict resolution.
- `src/dashboard` and `src/report` present settings and decision reports. Report colors, row striping, filtering, and sticky headings reuse the original report styles.
- `public/_locales/en` and `ja` follow RakuFill's Chrome localization approach. Builds verify both catalogs and placeholder parity.

Settings apply across X tabs. Usage, temporary show-all mode, and decision details are automatically associated with the X tab from which settings were opened.

Posts are hidden with an extension-owned attribute. Removing an override or disposing the engine removes only that attribute and preserves other extensions' inline styles and flags. Responses from before a settings change or cache clear are not adopted as new decisions.

Keyword rules are compiled only when matching settings change. Normalized text is cached for up to 500 post identities; rate decisions are retained for up to 2,000 post identities in the current timeline view. Temporary keyword overrides skip to the next matching rule without advancing the overridden rule's counter.

Sync operations and settings saves share the controller's write queue. Local sync revisions are recorded in the same settings-save operation. A persistent Chrome alarm retries pending sync and checks remote changes every five minutes while enabled. Background caches include the localized question instructions; regular dashboard polling omits decision rows. Separate report tabs retain the latest five session snapshots (up to 6 MB in total) so reloading a report works.

The count chip and toolbar open a native modal dialog in the current X tab, styled like Y!News Filter Plus. Its closed Shadow DOM holds an iframe for the existing extension-origin dashboard. Only the dashboard HTML is newly exposed to X/Twitter; credentials remain in the trusted extension frame and background. A per-tab, unpredictable session token authorizes embedded dashboard requests. Unauthorized frames cannot read or modify settings. Closing the modal revokes its token and leaves the X tab open; closing the tab or leaving X/Twitter also revokes the grant. Navigating within X keeps the dialog usable.

The dialog forwards Escape to the dashboard, which keeps the dialog open while an input field is focused and otherwise saves before closing. The dashboard performs browser permission requests directly from the user click; the background checks the actual granted permission before verification. Confirmation dialogs and requested TSV copying run in the originating top-level content script, without sending credentials through that route. Decision rows include a validated author handle and canonical X profile link; author metadata is not added to provider requests.

Chrome reference: [web-accessible resources](https://developer.chrome.com/docs/extensions/reference/manifest/web-accessible-resources).

If no content script can open the dialog, the same originating tab ID is retained in a reusable fallback settings tab. A top-frame startup message revokes stale frame grants after a reload. Unexpected native dialog closure reopens the existing frame; only the authenticated close response after saving removes it.


Content startup waits while X is at the root entry path `/` or has not rendered its `main` element. The wait only reads the page state: it does not navigate, mount the overlay, or hide posts. Once X selects its own route and mounts the main view, the existing engine starts. Empty timelines and searches still start normally because posts are not a readiness condition. Disconnection cancels the wait and removes its timer and listener.


After revoking stale frame grants, the content script registers the settings message receiver before waiting for the X view. Explicit user requests can therefore open, close, confirm, and copy through the authenticated settings dialog while filtering is not yet running. A lightweight snapshot reports that X is not ready; temporary show-all stays disabled until the engine starts. The engine attaches to the existing receiver rather than registering a second receiver.


Report rows reference per-post diagnostics so multiple conditions do not duplicate submitted text or log payloads. Processing traces retain up to 20 events and display traces up to 40 events per post, across at most 500 tracked entries each in the current view. Explicit reports, TSV and Console exports include these diagnostics; periodic count polling omits them. The details DOM is created on expansion. Saved reports retain the diagnostics in the same session snapshot as their rows, under the existing five-report / 6 MB cap. Cache and shared-request input text is identified separately from a new request sent by the current tab.

Console streaming uses a per-tab flag in background session storage, outside validated settings. GET restores it before the first scan; DEBUG_SET updates only the originating tab. Tab removal deletes it. It survives content-script reloads and service-worker restarts within the browser session, but is never synced or exported. Legacy aiDebug settings are ignored on read and removed from new sync payloads.

The standalone settings page uses a local dialog over a retained landing page. CLOSE is handled locally after the dashboard finishes saving; it does not close the settings tab. Native cancel and unexpected close events preserve the same editor and its input. Continuous Console output controls appear only in the embedded X-page settings UI.
