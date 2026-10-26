# XPostFilterPlus

[日本語](README.ja.md)

A Chrome extension that hides X posts using keyword matching and AI semantic classification. Version 0.1.0.

## Install

1. Open `chrome://extensions` and enable Developer mode.
2. Select **Load unpacked**, then choose this project's **dist** folder.
3. Reload X. Open settings from the extension icon or the hidden-post count chip.

After rebuilding, reload both the extension and the X page.

## Use

Enter one exclusion keyword per line. Settings save automatically and apply to all X tabs. The matching options handle case, full-width forms, accents, similar symbols, middle dots, spaces, and punctuation. Per-line `case` and `rate` options follow Y!News Filter Plus.

For semantic filtering, enable **Use AI classification**, add exclusion conditions, select a provider, and enter its credentials. Supported providers are Jev, OpenAI Decisions, and Cloudflare Clef / Clef-flash. Grant Chrome's connection permission for the chosen provider. API fees follow your agreement with the provider.

Only the post's own text is classified. Quote posts and link cards are excluded from that text. The count chip opens settings; hovering shows condition tags. Click a tag to temporarily disable that condition. Settings also let you temporarily show all posts in the originating X tab.

The settings page follows Y!News Filter Plus: keyword cleanup and sorting, AI status and usage, decision details, cache clearing, optional Chrome sync, JSON backup, and history restoration. Usage and decision details belong to the X tab from which settings were opened. Configuration applies across X tabs.

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

English and Japanese resources must be developed together. `npm run check:i18n` verifies keys and placeholders in both catalogs. UI behavior and styles reuse Y!News Filter Plus; Chrome localization follows RakuFill.

See the [privacy policy](docs/PRIVACY_POLICY.md), [test record](docs/TESTING.md), and [MIT license](LICENSE). Automated fixture tests do not establish real-provider accuracy; live browser checks are recorded separately.
