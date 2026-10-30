# XPostFilterPlus

An unofficial extension for hiding X (formerly Twitter) posts with keywords and AI. Not affiliated with X Corp.

Hide posts containing keywords, or use Jev, OpenAI Decisions, or Cloudflare Clef to hide posts that match conditions you describe. Each condition is evaluated separately; a post is hidden when any condition meets your threshold. AI classification is optional and requires your own provider API key and connection permission. For Cloudflare Clef, choose the clef or clef-flash model.

Filter posts across For you, Following, lists, search, and other timeline views. Hover over the hidden-post count chip to see conditions and temporarily disable one, or use the pause button to show all posts temporarily. Settings open over the current timeline and save automatically. Chrome sync, JSON backup, and history restoration are supported. Chrome sync is on by default and can be turned off in settings. Decision reports show the classification for each post and link to the posting account.

Filtering uses the post's own displayed text. Author names, quoted posts, and link-card text are excluded. Collapsed long posts are evaluated from the displayed portion; expanding a post triggers a new decision. Linked pages are not fetched.

Keyword matching runs on your device. With AI enabled, post text and conditions are sent to your chosen provider, whose fees and terms apply. API keys stay in local extension storage and are excluded from Chrome sync and settings exports. The extension has no developer-operated data collection server.

Setup guides for each AI provider and the privacy policy are available in the GitHub repository linked from the homepage field.
