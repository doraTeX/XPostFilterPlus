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
