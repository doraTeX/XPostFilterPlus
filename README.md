# XPostFilterPlus

[日本語](README.ja.md)

An unofficial Chrome extension that hides X posts using keyword matching and AI semantic classification. Version 0.1.0. Not affiliated with X Corp.

## Install

1. Open `chrome://extensions` and enable Developer mode.
2. Select **Load unpacked**, then choose this project's **dist** folder.
3. Reload X. Open settings from the extension icon or the hidden-post count chip. Settings appear as a modal dialog over the current X page. If the extension is not yet running in that tab, settings open in a separate tab with instructions to reload the original X page. The standalone page includes an Open settings button and an Open X link; closing its settings dialog keeps that page open.

After rebuilding, reload both the extension and the X page.

## Use

Enter one exclusion keyword per line. Settings save automatically and apply to all X tabs. The matching options handle letter case, accents, similar symbols, spaces, and punctuation. Per-line `case` and `rate` options follow Y!News Filter Plus.

For semantic filtering, enable **Use AI classification**, add exclusion conditions, select a provider, and enter its credentials. Supported providers are Jev, OpenAI Decisions, and Cloudflare Clef / Clef-flash. Grant Chrome's connection permission for the chosen provider. API fees follow your agreement with the provider.

Only the post's own text is classified. Quote posts and link cards are excluded from that text. For collapsed long posts, only the displayed text is evaluated; expanding the post triggers a new decision. The count chip opens the settings dialog over the current timeline; hovering shows condition tags. Click a tag to temporarily disable that condition. Hovering also reveals a red pause button at the top left of the chip. Click it to temporarily show all posts; the button turns green and resumes filtering when clicked again. This shares the state of Show all temporarily in settings for the originating X tab. Exclusion rates keep the same result for a post while scrolling; if a keyword is temporarily disabled, matching continues with the next keyword.

The settings page follows Y!News Filter Plus: keyword cleanup and sorting, AI status and usage, decision details, cache clearing, optional Chrome sync, JSON backup, and history restoration. Usage and decision details belong to the X tab from which settings were opened. Configuration applies across X tabs. Escape outside input fields and the Close button both wait for unsaved edits before dismissing the dialog; failed saves leave the input visible. Escape while an input field is focused leaves the dialog open. Decision reports include an author column linking to the posting account. Regular status updates fetch counts and usage only; report rows are fetched when requested. When classification is enabled, pending rows show the selected provider and model with “no decision result”; the status distinguishes posts waiting to enter the visible area, request-slot waits, connection checks, and classification in progress. Pending does not by itself indicate a provider failure.

**Continuous Console output (debugging)** is shown only in settings opened over an X page; the standalone settings page omits it. It is normally off because it can slow the page. When enabled, it survives reloads of the same X tab. Closing that tab clears it, and new tabs start with it off. It is excluded from Chrome sync and settings JSON.

Invalid keys, missing permissions, exhausted credit, and provider-wide failures pause AI processing and show a pink AI block with an explanation. Post-specific errors and refusals are skipped without interrupting other posts. Keyword filtering continues.

## Providers

- **Jev:** create a key in the [TypeSafe AI console](https://console.typesafe.ai/keys), select Jev, and save the key.
- **OpenAI Decisions:** use an OpenAI API key for a project with the required API access and available credit. Select OpenAI Decisions and save the key.
- **Cloudflare Clef:** open Workers AI in the [Cloudflare dashboard](https://dash.cloudflare.com/), obtain the account ID and a Workers AI API token with Read and Edit access for that account, then select Clef or Clef-flash in settings. See the [official REST API setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/).

## Development

```sh
npm ci
npm test
npm run build:extension
npm run package
```

`dist` is the unpacked extension; distribution ZIPs are in `release`. `npm run preview` serves a mock settings UI at `http://127.0.0.1:4178/preview/index.html`. Add `?lang=en` for English or `?lang=ja` for Japanese. Add `&state=unset` to inspect the unconfigured state.

Chrome sync uses the `alarms` permission to retry failed synchronization and check for changes every five minutes while enabled. AI decision caches are separated by provider, model, post text, and the actual localized instructions.

English and Japanese resources must be developed together. `npm run check:i18n` verifies keys and placeholders in both catalogs. UI behavior and styles reuse Y!News Filter Plus; Chrome localization follows RakuFill.

See the [privacy policy](docs/PRIVACY_POLICY.md), [test record](docs/TESTING.md), and [MIT license](LICENSE). Automated fixture tests do not establish real-provider accuracy; live browser checks are recorded separately.

Store submission drafts: [listing](docs/STORE_LISTING.md) and [privacy fields](store-assets/privacy-tab-en.txt).
