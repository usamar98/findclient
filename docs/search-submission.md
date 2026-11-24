# Lead To Client search submission guide

## 1. Submit the sitemap to Google

1. Open the Sitemaps report for the verified **leadtoclient.app** Domain property. [Open Google Search Console](https://search.google.com/search-console/sitemaps?resource_id=sc-domain%3Aleadtoclient.app)
2. Under **Add a new sitemap**, paste the full URL below and select **Submit**. Google reads the XML directly from your website.

   ```text
   https://leadtoclient.app/sitemap.xml
   ```

3. Check **Submitted sitemaps** for the exact URL, its status and its last read date. **Success** means Google could read the sitemap. The **Page indexing** report shows which URLs Google has indexed. [Google’s sitemap reporting guide](https://support.google.com/webmasters/answer/7451001)

For an immediate check on an important page, paste its full URL into **URL Inspection**, select **Test live URL**, then **Request indexing** if appropriate. Start with [the homepage](https://leadtoclient.app/), [How it works](https://leadtoclient.app/how-it-works) and [the service directory](https://leadtoclient.app/find-clients). The sitemap covers the remaining pages. [Google’s recrawl instructions](https://developers.google.com/search/docs/crawling-indexing/ask-google-to-recrawl)

## 2. Import the site into Bing

1. Sign in, choose **Import from Google Search Console**, authorize your verified Google account, and select **leadtoclient.app**. [Open Bing Webmaster Tools](https://www.bing.com/webmasters/) · [Microsoft’s import instructions](https://blogs.bing.com/webmaster/2019/9/Import-sites-from-Search-Console-to-Bing-Webmaster-Tools/)
2. Open **Sitemaps**. If the canonical sitemap is missing, select **Submit sitemap** and paste `https://leadtoclient.app/sitemap.xml`. Review the processing status and discovered URL count. [Bing’s sitemap guide](https://www.bing.com/webmasters/help/sitemaps-3b5cf6ed)
3. For manual verification instead of Google import, add `https://leadtoclient.app/` and choose **HTML meta tag**. Set the production Vercel variable `BING_SITE_VERIFICATION` to the exact **content value** Bing provides, redeploy, and select **Verify**. [Bing verification options](https://blogs.bing.com/webmaster/2025/6/Start-Using-Bing-Webmaster-Tools-to-Improve-Your-Site-Visibility/)

## 3. Notify IndexNow participants

The pack’s `indexnow.json` is a request body for IndexNow. Open the public key file and confirm it returns the same key as the JSON. From the extracted pack folder on Windows, run the command once for this release. An HTTP **200** acknowledges receipt. **202** means the URLs were received and key verification is pending. Future submissions should list only added, changed or deleted URLs. [Public key file](https://leadtoclient.app/indexnow-key.txt) · [IndexNow protocol](https://www.indexnow.org/documentation)

```powershell
curl.exe -i -X POST "https://api.indexnow.org/indexnow" -H "Content-Type: application/json; charset=utf-8" --data-binary "@indexnow.json"
```

## 4. AI search discovery

Google AI Overviews and AI Mode use Google Search eligibility. ChatGPT Search uses **OAI-SearchBot**, and Perplexity uses **PerplexityBot**. Keep the public pages readable without sign-in and allow these crawlers through the site's robots rules and hosting firewall. The reference files in the pack are for your records. These platforms discover the public website through crawling. [Google AI features](https://developers.google.com/search/docs/appearance/ai-features) · [OpenAI publisher guidance](https://help.openai.com/en/articles/12627856) · [Perplexity crawlers](https://docs.perplexity.ai/docs/resources/perplexity-crawlers)

Claude uses **Claude-SearchBot** for web search. Bing Webmaster Tools also has an **AI Performance** report for supported Microsoft AI experiences, including Copilot. DuckDuckGo sources many traditional links from Bing, so the Bing submission is relevant there too. [Anthropic crawler documentation](https://support.claude.com/en/articles/8896518-does-anthropic-crawl-data-from-the-web-and-how-can-site-owners-block-the-crawler) · [Bing AI reporting](https://blogs.bing.com/search/2026/6/New-AI-Visibility-Insights-in-Bing-Webmaster-Tools-Intents-Topics-Citation-Share-Compare/) · [DuckDuckGo sources](https://duckduckgo.com/duckduckgo-help-pages/results/sources)

## Optional Yandex submission

For Yandex, add and verify `https://leadtoclient.app/` in Yandex Webmaster, open **Indexing → Sitemap files**, and enter the same live sitemap URL. The site also advertises it in `robots.txt`. [Yandex sitemap instructions](https://yandex.com/support/webmaster/en/indexing-options/sitemap)

## Files in the pack

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
