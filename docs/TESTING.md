# Verification record

## Automated checks

The X extension has 217 passing tests covering extraction, DOM reuse, routing, temporary overrides, tooltip controls, spinner state, token accounting, provider requests, caches, key verification, error scopes, settings persistence, sync conflicts, bilingual UI, safe report rendering, and report filters.

`npm run check:i18n` verifies the English and Japanese catalogs and placeholders. `npm run build:extension` checks TypeScript and creates the unpacked extension. Packaging verifies manifest identity and scans for unintended local paths or unrelated endpoints.

The Y!News Filter Plus provider-label correction has 47 passing engine tests, including newly added checks for disabled AI, unrequested rows, requests in progress, and cached results.

Console streaming tests cover same-tab reloads and worker recreation, new-tab defaults, tab-close cleanup, sender-bound updates, and exclusion of legacy aiDebug values from settings and sync. These checks use mocked Chrome APIs.

## Chrome checks — 2026-10-27

- **Following:** a matching `お名前` post was hidden; the user also confirmed the count chip and condition tooltip. The test tab showed 12 post cards and one hidden card.
- **Search / Top:** exact-match `お名前` search showed 105 loaded cards, 97 hidden cards, and no visible cards among the 89 cards whose first body contained the exact keyword. Later-loaded results were also filtered.
- **For you:** selected successfully; 13 cards and 19 body elements were detected with the extension overlay present.
- **Pinned TeX list:** selected within `/home`; 10 cards and 12 body elements were detected. Switching the selected timeline without changing the URL has a dedicated automated regression test.
- **Search / Latest:** the real view and post structure were inspected. An exact-match retest encountered a browser automation timeout, so complete live hiding verification for that view is still pending.

The For you and pinned-list samples did not provide a matching-keyword case during inspection. Their route and DOM handling are covered by fixtures; this does not replace live matching-post verification.

Japanese and English settings and report previews were inspected in a browser. Report filters, select-all/deselect-all, category colors, and alternating normal rows were verified against the shared production renderer.

These checks used keyword filtering and mocked API responses. Live AI accuracy and performance in the X extension have not been verified. AI verification performed earlier in Y!News Filter Plus is not treated as verification of X posts.

Reload both the extension and X after rebuilding; an old registered loader can otherwise refer to a removed hashed asset.

## Extension reload recovery

Regression tests simulate both synchronous and asynchronous context invalidation, a missing runtime ID, failed translation APIs, locale preservation, one-time reload notices, stopping observers and timers, and ignoring the completion of old in-flight requests. Ordinary per-post API failures remain distinct from extension invalidation.

## Audit follow-up — 2026-10-27

Regression tests cover stable rate decisions across repeated scans and virtualized cell removal, keyword override fallback, normalization reuse, lightweight polling with explicit detail retrieval, localized-prompt cache separation, sync retries through alarms, serialization of sync and editor writes, conflict protection, and report reloads with retention limited to the latest five reports.

These tests use DOM fixtures, mocked Chrome APIs, and mocked provider responses. Live provider calls and Chrome sync between physical devices were not performed as part of this audit follow-up. The manifest adds `alarms` solely for sync retries and periodic reconciliation while sync is enabled. Icons were regenerated at 16, 48, and 128 pixels and visually inspected after adding the superscript plus sign.

The follow-up audit adds regression coverage for preserving keyword matches and rate decisions while filtering is disabled or all posts are temporarily shown, including resuming filtering. Store privacy-field drafts are in `store-assets/privacy-tab-en.txt` and `privacy-tab-ja.txt`; both policy versions explain every declared permission.

## Settings dialog and author column — 2026-10-27

All 124 tests across 10 files pass. Coverage includes modal reuse, keeping the dialog open on Escape while input fields are focused, IME handling, saving before closing, preserving failed edits, keeping the original tab open, per-tab authorization and revocation for embedded settings, credential isolation, confirmation and clipboard forwarding, and checking actual Chrome permissions.

Author extraction uses the posting account's permalink or User-Name links and excludes quoted authors. Reports place a validated profile link in column two; TSV and Console include the handle. Author metadata is not added to provider requests.

Local previews in Chrome verified Japanese and English modal overlays, returning to the original page with Escape and Close, and the Japanese author column and profile URL. These previews use mock data; they do not establish that the installed extension frame or live AI calls work on the real X site.

## Pause shortcut (2026-10-27)

X: 126 tests pass. Y!News: 120 tests pass. Regression coverage verifies that the chip shortcut and settings button share the same pause state, resume the original rules without changing saved settings, and suspend both keyword and AI exclusions. The Y!News check also covers removing and restoring highlights and updating the settings button through the menu command.

Chrome local previews verified the red pause / green play controls and visible hide/show transitions in both extensions. In Y!News, the preview also verified that highlights disappear while paused and return on resume, including resuming from the settings dialog. These checks use mock responses and do not make live API calls.

## Reports when AI is unused (2026-10-27)

X: 133 tests pass; Y!News: 125 tests pass. AI off, no conditions, filtering off, and temporarily showing all posts are classified as normal visibility, with no pending count. Rows and TSV exports give the reason AI is unused instead of implying a request is still awaiting a result. Missing credentials or provider failures remain distinct from these intentional bypass states.

The empty-condition regression uses one keyword exclusion and eleven normal posts, then adds a condition to verify that classification starts again. The Y!News regression also checks enabling highlights by adding only an interest condition. Chrome's local mock preview confirmed one keyword exclusion, eleven normal rows, and zero pending rows in the X report; no live API calls were used.

## Settings audit follow-up (2026-10-27)

All 142 X tests and 127 Y!News tests pass. Added coverage includes fallback settings when a content script is unavailable, reusing that settings tab, retaining the originating X tab, bilingual reload guidance, expiring an old frame grant on page startup, and recovering from a native dialog close before saving finishes.

Chrome local previews used real dialogs and the production settings UI with simulated save failures. In both extensions, three consecutive Escape presses while editing retained the input; a failed Close operation also kept it visible. On the real X page, the refreshed extension displayed its chip and opened the embedded settings UI. Chrome then blocked further automation while extension UI was open. The user manually confirmed that the permission dialog opens and the copied TSV can be pasted. X lacked the Copied! feedback, so matching success feedback was added and is shown only after copying succeeds. Automated tests and local previews make no live AI requests; the manual checks do not establish provider accuracy.

After updating the build, the user also confirmed that the Copied! feedback appears successfully on the real X page.


## Settings initialization failure recovery (2026-10-27)

All 156 X tests and 130 Y!News tests pass. X coverage includes a close button after a failed settings GET, exiting before the dashboard is created, validating the frame source and origin for close responses, dismissing an unresponsive frame, retaining an acknowledged editor during editing or saving, and cancelling stale close timers. A PAGE_READY storage failure no longer prevents filtering from starting; extension disconnection still prevents startup. Y!News allows dismissal after disconnection without retrying unsavable edits, including while an earlier save is waiting.

Chrome local previews confirmed that the X settings load-error screen can be closed, repeated Escape and save failure retain entered text, and the Y!News dialog can be dismissed after a simulated disconnection. These checks used mock data without real AI calls or changes to the installed extension's settings.


## Storage notification availability (2026-10-27)

All 164 tests pass. The dashboard no longer assumes chrome.storage.onChanged is available. If accessing or subscribing to it fails, authenticated settings refreshes run every 1.5 seconds until the dashboard is disposed. The usual notification path still filters local settings changes and performs no additional polling. Coverage includes absent APIs, a throwing storage getter, subscription failure, and cleanup after extension invalidation. This regression is covered with mocked Chrome APIs; installed-extension verification requires reloading the extension and X page.

## Closing-message target origin (2026-10-27)

The settings load-error screen sends its empty-editor close message only to the actual immediate parent origin obtained from Chrome's ancestorOrigins, and only when that origin is https://x.com or https://twitter.com. It does not use a wildcard. The parent still verifies the source frame and extension origin. All 23 tests in the three related suites pass, covering both allowed parents and rejecting unknown or lookalike origins. Bilingual resources and the production build pass; the new path has not been rechecked on a live X page.


## Entry-route startup (2026-10-27)

All 181 tests pass. Startup tests cover waiting at `/` even when a welcome screen already has a main element, waiting for a main element after routing, starting empty home/search/list/profile/post views, and cancellation on extension disconnection without leaving timers or listeners. The startup wait does not rewrite the page DOM or URL.

The reported intermittent welcome screen / missing redirect was not reproduced in the diagnostic session. As a defensive change, filtering now starts after X's own route and main view are ready. After the user reloaded the new extension build, two visits to https://x.com/ reached https://x.com/home and displayed the Following timeline, with 10 and 11 post elements respectively. The extension overlay appeared after the main view was ready. These observations do not establish the root cause of the original intermittent symptom or evaluate AI accuracy.


## Settings during startup wait (2026-10-27)

All 187 tests and 317 bilingual resource keys pass. The settings receiver is available during the entry-route wait after stale grants are revoked. Tests cover opening and closing settings, confirmation and copying before engine startup, rejecting other senders, localized waiting snapshots, preventing temporary show-all during initialization, enabling it after startup, reusing a single receiver, and removing it on disconnection. The manifest now links to the published GitHub repository. The accidentally generated ignored .build-check/y-dummy.tgz was removed. This audit follow-up used automated checks; it has not been rechecked in the installed Chrome extension.


## Expandable decision details (2026-10-27)

All 199 tests and 353 bilingual keys pass. Reports now have a Details column with processing status, last tab-local processing time, source, keyword / temporary-release / AI flags, bounded processing and display logs, and AI input text. Exports include the same diagnostics. Tests cover full input beyond the abbreviated main column, cache and shared-request attribution, error/refusal distinction, state resets, deduplicated multi-condition payloads, display-log bounds, session report reloads, legacy reports without diagnostics, safe text rendering, and lazy expansion without duplicate content. Chrome local previews confirmed Japanese and English expansion and layout. No real provider requests were made during these checks.

## Standalone settings page (2026-10-27)

The standalone page now keeps a localized landing page behind the settings dialog, with automatic-save and per-device credential guidance, Open settings, and Open X. Closing waits for saves and keeps the page available for reopening. Tests cover both languages, delayed saves, failed saves, input-focused Escape, and unexpected native close events. All 210 tests, 358 bilingual keys, and the extension build pass. Chrome local previews confirmed the Japanese and English landing page, reopening, hiding continuous Console output in standalone settings, and retaining it in settings over the mock timeline. The compact Japanese button measures 105 × 39 CSS pixels with a 24-pixel link gap. No real X or provider requests were used.

## Pending provider labels (2026-10-27)

Pending rows show the selected provider and model with no-decision-result status, while keyword-only and bypassed rows retain their unused labels. Tests cover Jev, OpenAI Decisions, both Clef models, viewport deferral, request-slot waits, connection checks, unset readiness, and Japanese/English table, TSV, and Console output. Pending labels do not create submitted-text or elapsed-time records. All 217 tests pass; both resource catalogs contain 362 matching keys. Network and Chrome APIs are mocked.
