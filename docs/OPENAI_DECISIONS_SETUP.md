# Set up OpenAI Decisions

1. Sign in to [OpenAI Platform](https://platform.openai.com/) and select the organization and project you intend to use.
2. Check the project's API access, billing, and available credit.
3. Create or copy an active [OpenAI API key](https://platform.openai.com/api-keys).
4. In X Post Filter Plus settings, enable **Use AI classification** and select **OpenAI Decisions**.
5. Enter the key, select **Allow connections to this provider**, and grant Chrome's permission request.
6. Add one exclusion condition per line and return to X.

Settings save automatically. The extension checks a newly supplied key with a minimal request. Invalid credentials, missing permissions, or exhausted credit produce a pink AI section and an actionable status message. Fix the cause and choose **Reclassify now**.

The extension sends post text and classification conditions to OpenAI. Fees follow your API agreement. API keys are stored locally and excluded from sync, exported settings, and settings history.

[日本語](OPENAI_DECISIONS_SETUP.ja.md) · [Privacy](PRIVACY_POLICY.md)
