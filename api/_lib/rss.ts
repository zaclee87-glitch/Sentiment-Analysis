import crypto from "crypto";
import { XMLParser } from "fast-xml-parser";

export interface RawArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedTime: string;
  snippet: string;
}

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "@_",
  textNodeName: "#text",
  trimValues: true,
});

/**
 * Remove HTML tags and decode common HTML entities.
 */
export function cleanHtml(text: string): string {
  if (!text) return "";
  return text
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Create a deterministic 12-char hash for an article URL / title.
 */
export function generateArticleId(url: string, title: string): string {
  const normalized = (url || title || "").trim().toLowerCase();
  return crypto.createHash("md5").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Normalize title for deduplication (strip source suffixes like " - Bloomberg", " - Reuters", etc.).
 */
export function normalizeTitle(title: string): string {
  return title
    .replace(/\s*-\s*[A-Za-z0-9\s.,]+$/, "") // remove trailing " - Source"
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .toLowerCase()
    .trim();
}

/**
 * Safely parse date string into ISO, falling back to current time.
 */
export function parseDateToIso(dateStr: any): string {
  if (!dateStr) return new Date().toISOString();
  try {
    const d = new Date(dateStr);
    if (!isNaN(d.getTime())) {
      return d.toISOString();
    }
  } catch {
    // fallback
  }
  return new Date().toISOString();
}

/**
 * Fetch and parse standard RSS 2.0 or Atom feed.
 */
export async function fetchRssFeed(
  url: string,
  defaultSource: string,
  headers: Record<string, string> = {}
): Promise<RawArticle[]> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          headers["User-Agent"] ||
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept: "application/rss+xml, application/xml, text/xml, application/atom+xml, */*",
        ...headers,
      },
    });

    clearTimeout(timeout);

    if (!res.ok) {
      console.warn(`RSS fetch returned HTTP ${res.status} for ${url}`);
      return [];
    }

    const xml = await res.text();
    const parsed = parser.parse(xml);
    const articles: RawArticle[] = [];

    // Case 1: RSS 2.0 (<rss><channel><item>...</item></channel></rss>)
    if (parsed.rss?.channel?.item) {
      const items = Array.isArray(parsed.rss.channel.item)
        ? parsed.rss.channel.item
        : [parsed.rss.channel.item];

      for (const item of items) {
        const title = cleanHtml(item.title || "");
        if (!title) continue;

        let link = typeof item.link === "string" ? item.link : item.link?.["#text"] || "";
        if (!link && item.guid) {
          link = typeof item.guid === "string" ? item.guid : item.guid?.["#text"] || "";
        }

        const pubDate = parseDateToIso(item.pubDate);
        const snippet = cleanHtml(item.description || item["content:encoded"] || "");
        
        let source = defaultSource;
        if (item.source) {
          source = typeof item.source === "string" ? item.source : item.source?.["#text"] || defaultSource;
        }

        articles.push({
          id: generateArticleId(link, title),
          title,
          source,
          url: link,
          publishedTime: pubDate,
          snippet: snippet.slice(0, 320),
        });
      }
    }

    // Case 2: Atom Feed (<feed><entry>...</entry></feed>)
    if (parsed.feed?.entry) {
      const entries = Array.isArray(parsed.feed.entry)
        ? parsed.feed.entry
        : [parsed.feed.entry];

      for (const entry of entries) {
        const title = cleanHtml(entry.title || "");
        if (!title) continue;

        let link = "";
        if (typeof entry.link === "string") {
          link = entry.link;
        } else if (entry.link?.["@_href"]) {
          link = entry.link["@_href"];
        } else if (Array.isArray(entry.link)) {
          const alternate = entry.link.find((l: any) => l["@_rel"] === "alternate") || entry.link[0];
          link = alternate?.["@_href"] || "";
        }

        const pubDate = parseDateToIso(entry.updated || entry.published);
        const snippet = cleanHtml(entry.summary || entry.content || "");

        articles.push({
          id: generateArticleId(link, title),
          title,
          source: defaultSource,
          url: link,
          publishedTime: pubDate,
          snippet: snippet.slice(0, 320),
        });
      }
    }

    return articles;
  } catch (err) {
    console.warn(`Error fetching or parsing RSS feed ${url}:`, err);
    return [];
  }
}

/**
 * Deduplicate articles by normalized title and URL.
 */
export function deduplicateArticles(articles: RawArticle[]): RawArticle[] {
  const seenUrls = new Set<string>();
  const seenTitles = new Set<string>();
  const result: RawArticle[] = [];

  // Sort newest first
  const sorted = [...articles].sort(
    (a, b) => new Date(b.publishedTime).getTime() - new Date(a.publishedTime).getTime()
  );

  for (const art of sorted) {
    const cleanUrl = (art.url || "").trim().toLowerCase();
    const cleanTitle = normalizeTitle(art.title);

    if (cleanUrl && seenUrls.has(cleanUrl)) continue;
    if (cleanTitle && seenTitles.has(cleanTitle)) continue;

    if (cleanUrl) seenUrls.add(cleanUrl);
    if (cleanTitle) seenTitles.add(cleanTitle);

    result.push(art);
  }

  return result;
}
