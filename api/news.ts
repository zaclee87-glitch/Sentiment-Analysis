import type { Request, Response } from "express";
import { fetchFinnhubCompanyNews } from "./_lib/finnhub.js";
import { deduplicateArticles, fetchRssFeed } from "./_lib/rss.js";

export default async function handler(req: Request | any, res: Response | any) {
  try {
    const ticker = ((req.query?.ticker || req.body?.ticker || "") as string).trim().toUpperCase();

    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker query parameter" });
    }

    const finnhubKey = process.env.FINNHUB_API_KEY;

    // 1. Primary path: Finnhub Company News API
    if (finnhubKey) {
      try {
        const articles = await fetchFinnhubCompanyNews(ticker);
        if (articles.length > 0) {
          return res.status(200).json({
            ticker,
            count: articles.length,
            articles,
            provider: "finnhub",
            fetchedAt: new Date().toISOString(),
          });
        }
      } catch (finnhubErr) {
        console.warn(`Finnhub news fetch failed for ${ticker}, falling back:`, finnhubErr);
      }
    }

    // 2. Fallback path: RSS feeds (if Finnhub key missing or returned empty)
    const encodedTicker = encodeURIComponent(ticker);
    const cleanSearchTicker = ticker.replace(/^\^/, "");

    const feedsToFetch: Array<Promise<any>> = [
      fetchRssFeed(
        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodedTicker}`,
        "Yahoo Finance"
      ),
      fetchRssFeed(
        `https://news.google.com/rss/search?q=${encodeURIComponent(cleanSearchTicker + " stock OR earnings OR shares")}&hl=en-US&gl=US&ceid=US:en`,
        "Google News"
      ),
    ];

    if (!ticker.startsWith("^") && ticker.length <= 5 && !ticker.includes("=")) {
      feedsToFetch.push(
        fetchRssFeed(
          `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(cleanSearchTicker)}&type=&dateb=&owner=exclude&start=0&count=10&output=atom`,
          "SEC EDGAR",
          {
            "User-Agent": "AuraTerminalBot research@auraterminal.internal",
          }
        )
      );
    }

    const results = await Promise.allSettled(feedsToFetch);
    const allArticles = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

    const deduped = deduplicateArticles(allArticles);
    const finalArticles = deduped.slice(0, 30);

    return res.status(200).json({
      ticker,
      count: finalArticles.length,
      articles: finalArticles,
      provider: "rss-fallback",
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Error in /api/news:", err);
    return res.status(500).json({
      error: "Failed to fetch ticker news",
      details: err?.message || String(err),
    });
  }
}
