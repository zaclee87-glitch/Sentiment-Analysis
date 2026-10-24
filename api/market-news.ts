import type { Request, Response } from "express";
import { fetchFinnhubMarketNews } from "./_lib/finnhub.js";
import { deduplicateArticles, fetchRssFeed } from "./_lib/rss.js";

export default async function handler(req: Request | any, res: Response | any) {
  try {
    const finnhubKey = process.env.FINNHUB_API_KEY;

    // 1. Primary path: Finnhub Market News API
    if (finnhubKey) {
      try {
        const articles = await fetchFinnhubMarketNews();
        if (articles.length > 0) {
          return res.status(200).json({
            count: articles.length,
            articles,
            provider: "finnhub",
            fetchedAt: new Date().toISOString(),
          });
        }
      } catch (finnhubErr) {
        console.warn("Finnhub market news fetch failed, falling back:", finnhubErr);
      }
    }

    // 2. Fallback path: Macro RSS feeds
    const feedsToFetch = [
      fetchRssFeed(
        "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
        "CNBC"
      ),
      fetchRssFeed(
        "https://finance.yahoo.com/news/rssindex",
        "Yahoo Finance"
      ),
      fetchRssFeed(
        `https://news.google.com/rss/search?q=${encodeURIComponent("stock market Wall Street Federal Reserve inflation")}&hl=en-US&gl=US&ceid=US:en`,
        "Google News"
      ),
    ];

    const results = await Promise.allSettled(feedsToFetch);
    const allArticles = results.flatMap((r) => (r.status === "fulfilled" ? r.value : []));

    const deduped = deduplicateArticles(allArticles);
    const topArticles = deduped.slice(0, 30);

    return res.status(200).json({
      count: topArticles.length,
      articles: topArticles,
      provider: "rss-fallback",
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Error in /api/market-news:", err);
    return res.status(500).json({
      error: "Failed to fetch market news",
      details: err?.message || String(err),
    });
  }
}
