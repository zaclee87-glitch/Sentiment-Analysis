import type { Request, Response } from "express";
import { deduplicateArticles, fetchRssFeed } from "./_lib/rss.js";

export default async function handler(req: Request | any, res: Response | any) {
  try {
    const feedsToFetch = [
      // CNBC Top News & Markets
      fetchRssFeed(
        "https://search.cnbc.com/rs/search/combinedcms/view.xml?partnerId=wrss01&id=10000664",
        "CNBC"
      ),
      // Yahoo Finance Top Stories
      fetchRssFeed(
        "https://finance.yahoo.com/news/rssindex",
        "Yahoo Finance"
      ),
      // Google News Stock Market
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
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Error in /api/market-news:", err);
    return res.status(500).json({
      error: "Failed to fetch market news feeds",
      details: err?.message || String(err),
    });
  }
}
