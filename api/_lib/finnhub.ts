import crypto from "crypto";

export interface FinnhubArticle {
  category: string;
  datetime: number; // Unix timestamp in seconds
  headline: string;
  id: number;
  image?: string;
  related?: string;
  source: string;
  summary: string;
  url: string;
}

export interface StandardArticle {
  id: string;
  title: string;
  source: string;
  url: string;
  publishedTime: string;
  snippet: string;
}

/**
 * Generate a consistent deterministic hash for an article.
 */
export function generateArticleId(url: string, title: string): string {
  const normalized = (url || title || "").trim().toLowerCase();
  return crypto.createHash("md5").update(normalized).digest("hex").slice(0, 16);
}

/**
 * Map special symbols (indices, commodities) to Finnhub-supported symbols
 */
export function mapToFinnhubSymbol(symbol: string): string {
  const upper = symbol.trim().toUpperCase();
  const mapping: Record<string, string> = {
    "^GSPC": "SPY",
    "^DJI": "DIA",
    "^IXIC": "QQQ",
    "^RUT": "IWM",
    "^VIX": "VIXY",
  };
  return mapping[upper] || upper.replace(/^\^/, "");
}

/**
 * Fetch company financial news directly from Finnhub API
 */
export async function fetchFinnhubCompanyNews(
  ticker: string,
  daysBack = 30
): Promise<StandardArticle[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    throw new Error("FINNHUB_API_KEY is not configured.");
  }

  const cleanSymbol = mapToFinnhubSymbol(ticker);
  const now = new Date();
  const toDate = now.toISOString().split("T")[0];
  const fromDate = new Date(now.getTime() - daysBack * 24 * 60 * 60 * 1000)
    .toISOString()
    .split("T")[0];

  const url = `https://finnhub.io/api/v1/company-news?symbol=${encodeURIComponent(
    cleanSymbol
  )}&from=${fromDate}&to=${toDate}&token=${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);

  if (!res.ok) {
    throw new Error(`Finnhub company-news API responded with HTTP ${res.status}`);
  }

  const data = (await res.json()) as FinnhubArticle[];
  if (!Array.isArray(data)) {
    return [];
  }

  // Deduplicate and format
  const seenUrls = new Set<string>();
  const articles: StandardArticle[] = [];

  for (const item of data) {
    if (!item.headline || !item.url) continue;
    const cleanUrl = item.url.trim().toLowerCase();
    if (seenUrls.has(cleanUrl)) continue;
    seenUrls.add(cleanUrl);

    articles.push({
      id: generateArticleId(item.url, item.headline),
      title: item.headline.trim(),
      source: item.source || "Finnhub",
      url: item.url,
      publishedTime: new Date(item.datetime * 1000).toISOString(),
      snippet: (item.summary || item.headline).slice(0, 320).trim(),
    });
  }

  return articles.slice(0, 35);
}

/**
 * Fetch market-wide general news directly from Finnhub API
 */
export async function fetchFinnhubMarketNews(): Promise<StandardArticle[]> {
  const token = process.env.FINNHUB_API_KEY;
  if (!token) {
    throw new Error("FINNHUB_API_KEY is not configured.");
  }

  const url = `https://finnhub.io/api/v1/news?category=general&token=${token}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  const res = await fetch(url, { signal: controller.signal });
  clearTimeout(timeout);

  if (!res.ok) {
    throw new Error(`Finnhub general news API responded with HTTP ${res.status}`);
  }

  const data = (await res.json()) as FinnhubArticle[];
  if (!Array.isArray(data)) {
    return [];
  }

  const seenUrls = new Set<string>();
  const articles: StandardArticle[] = [];

  for (const item of data) {
    if (!item.headline || !item.url) continue;
    const cleanUrl = item.url.trim().toLowerCase();
    if (seenUrls.has(cleanUrl)) continue;
    seenUrls.add(cleanUrl);

    articles.push({
      id: generateArticleId(item.url, item.headline),
      title: item.headline.trim(),
      source: item.source || "Finnhub",
      url: item.url,
      publishedTime: new Date(item.datetime * 1000).toISOString(),
      snippet: (item.summary || item.headline).slice(0, 320).trim(),
    });
  }

  return articles.slice(0, 35);
}
