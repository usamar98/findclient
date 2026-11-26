# Lead To Client search submission guide

## 1. Submit the sitemap to Google

1. Open the Sitemaps report for the verified **leadtoclient.app** Domain property. [Open Google Search Console](https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Aleadtoclient.app)
2. Under **Add a new sitemap**, paste the full URL below and select **Submit**. Google reads the XML directly from your website.

   ```text
   https://leadtoclient.app/sitemap.xml
   ```

3. Check **Submitted sitemaps** for the exact URL, its status and its last read date. **Success** means Google could read the sitemap. The **Page indexing** report shows which URLs Google has indexed. [Google’s sitemap reporting guide](https://support.google.com/webmasters/answer/7451001)

If the sitemap is already submitted, Google can discover new public pages through that same URL. To check the new platform guide, inspect `https://leadtoclient.app/platforms` in **URL Inspection**, select **Test live URL**, then **Request indexing** if appropriate. [Platform guide](https://leadtoclient.app/platforms) · [Google’s recrawl instructions](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)

## 2. Import the site into Bing

1. Sign in, choose **Import from Google Search Console**, authorize your verified Google account, and select **leadtoclient.app**. [Open Bing Webmaster Tools](https://www.bing.com/webmasters/) · [Microsoft’s import instructions](https://blogs.bing.com/webmaster/2019/9/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools/)
2. Open **Sitemaps**. If the canonical sitemap is missing, select **Submit sitemap** and paste `https://leadtoclient.app/sitemap.xml`. Review the processing status and discovered URL count. [Bing’s sitemap guide](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed)
3. For manual verification instead of Google import, add `https://leadtoclient.app/` and choose **HTML meta tag**. Set the production Vercel variable `BING_SITE_VERIFICATION` to the exact **content value** Bing provides, redeploy, and select **Verify**. [Bing verification options](https://blogs.bing.com/webmaster/2025/6/Start-Using-Bing-Webmaster-Tools-to-Improve-Your-Site-Visibility/)

## 3. Notify IndexNow participants

The November 24 launch pack includes a sample `indexnow.json`. For a later release, update its `urlList` with the public URLs added, changed or deleted in that release. Include `https://leadtoclient.app/platforms` when notifying engines about the new platform guide. Check that the public key file matches the key in the JSON, then run the command from the folder containing your updated request. An HTTP **200** acknowledges receipt. **202** means the URLs were received and key verification is pending. [Public key file](https://leadtoclient.app/indexnow-key.txt) · [IndexNow protocol](https://www.indexnow.org/documentation)

```powershell
curl.exe -i -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json; charset=utf-8" --data-binary "@indexnow.json"
```

## 4. AI search discovery

The platform guide documents Live Research sources, paid-work filters and how post age is measured. Its Markdown edition and the AI reference files update with the website. Use the HTML guide for URL Inspection. [Platform guide](https://leadtoclient.app/platforms) · [Markdown edition](https://leadtoclient.app/guides/platforms.md) · [AI directory](https://leadtoclient.app/llms.txt) · [Full AI guide](https://leadtoclient.app/llms-full.txt)

Google AI Overviews and AI Mode use Google Search eligibility. ChatGPT Search uses **OAI-SearchBot**, and Perplexity uses **PerplexityBot**. Keep the public pages readable without sign-in and allow these crawlers through the site's robots rules and hosting firewall. The reference files in the pack are for your records. These platforms discover the public website through crawling. [Google AI features](https://developers.google.com/search/docs/appearance/ai-features) · [OpenAI publisher guidance](https://help.openai.com/en/articles/12627856) · [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

Claude uses **Claude-SearchBot** for web search. Bing Webmaster Tools also has an **AI Performance** report for supported Microsoft AI experiences, including Copilot. DuckDuckGo sources many traditional links from Bing, so the Bing submission is relevant there too. [Anthropic crawler documentation](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Bing AI reporting](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/) · [DuckDuckGo sources](https://duckduckgo.com/duckduckgo-help-pages/results/sources)

## Optional Yandex submission

For Yandex, add and verify `https://leadtoclient.app/` in Yandex Webmaster, open **Indexing → Sitemap files**, and enter the same live sitemap URL. The site also advertises it in `robots.txt`. [Yandex sitemap instructions](https://yandex.com/support/webmaster/en/indexing-options/sitemap)

## Files in the November 24 launch snapshot

| File | Use |
| --- | --- |
| `sitemap.xml` | Local copy of the sitemap. Submit its **live URL** to Google and Bing. |
| `urls.txt` | One canonical page URL per line. Use it to copy URLs for inspection. |
| `indexnow.json` | Body for the IndexNow request above. |
| `reference/indexnow-key.txt` | Public ownership file used by the IndexNow payload. |
| `reference/robots.txt` | Copy of the site's public crawler rules. |
| `reference/llms.txt` and `reference/llms-full.txt` | Directory and expanded text of public product information. |
| `reference/rss.xml` | Feed for journal readers and RSS tools. |

## Domain and verification settings

Keep the existing verification record or file in place. If the Domain property ever needs reverification, use the exact DNS record Google issues at the authoritative DNS provider. A Google HTML tag applies to a **URL-prefix property** such as `https://leadtoclient.app/`. For that method, set `GOOGLE_SITE_VERIFICATION` to the tag's content value in production and redeploy. [Google ownership verification](https://support.google.com/webmasters/answer/9008080)

The canonical host is **leadtoclient.app**. In the production project's **Domains** settings, check the existing **www.leadtoclient.app** entry, its DNS status and HTTPS certificate. Set its redirect to permanent (308) with **leadtoclient.app** as the target. Once the certificate covers **www**, opening `https://www.leadtoclient.app/pricing` should take you to `https://leadtoclient.app/pricing`. [Production project domains](https://vercel.com/otherusama-2557s-projects/findclient/settings/domains) · [Vercel domain setup](https://vercel.com/docs/domains/working-with-domains/add-a-domain)
