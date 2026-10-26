# Set up Cloudflare Clef

XPostFilterPlus needs your Cloudflare **account ID** and a **Workers AI API token**.

1. Sign in to the [Cloudflare dashboard](https://dash.cloudflare.com/) and select the account to use.
2. Open **Workers AI**, then **Use REST API**. The wording may vary with dashboard updates or language.
3. Copy the **Account ID**, which contains 32 hexadecimal characters.
4. Choose **Create a Workers AI API Token**. Give it a recognizable name such as `XPostFilterPlus`.
5. Check the permissions:
   - Account → Workers AI → Read
   - Account → Workers AI → Edit
6. Under account resources, include the same account selected in step 1. Create the token and copy it.
7. Open XPostFilterPlus settings, enable **Use AI classification**, and select **Cloudflare Clef / Clef-flash**.
8. Enter the token and account ID. Choose **clef** or **clef-flash**; both use the same account and token.
9. Select **Allow connections to this provider** and grant Chrome's permission request.
10. Add one exclusion condition per line and return to X. Settings save automatically.

For HTTP 401 or 403, verify the token, Workers AI permissions, and account resource. For quota or billing errors, check the account's Workers AI usage and billing. After resolving a provider-wide error, choose **Reclassify now**.

Post text and classification conditions are sent to Cloudflare. Provider terms govern pricing and free allowances.

[Official REST API setup](https://developers.cloudflare.com/workers-ai/get-started/rest-api/) · [日本語](CLOUDFLARE_SETUP.ja.md) · [Privacy](PRIVACY_POLICY.md)
