# Verification record

## Automated checks

The X extension has 80 passing tests covering extraction, DOM reuse, routing, temporary overrides, tooltip controls, spinner state, token accounting, provider requests, caches, key verification, error scopes, settings persistence, sync conflicts, bilingual UI, safe report rendering, and report filters.

`npm run check:i18n` verifies the English and Japanese catalogs and placeholders. `npm run build:extension` checks TypeScript and creates the unpacked extension. Packaging verifies manifest identity and scans for unintended local paths or unrelated endpoints.

The Y!News Filter Plus provider-label correction has 45 passing engine tests, including newly added checks for disabled AI, unrequested rows, requests in progress, and cached results.

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
