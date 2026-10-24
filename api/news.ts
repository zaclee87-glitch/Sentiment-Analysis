import type { Request, Response } from "express";
import { deduplicateArticles, fetchRssFeed } from "./_lib/rss.js";

export default async function handler(req: Request | any, res: Response | any) {
  try {
    const ticker = ((req.query?.ticker || req.body?.ticker || "") as string).trim().toUpperCase();

    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker query parameter" });
    }

    // Clean symbol for feeds (e.g., ^GSPC or BRK.B or BTC-USD)
    const encodedTicker = encodeURIComponent(ticker);
    const cleanSearchTicker = ticker.replace(/^\^/, "");

    const feedsToFetch: Array<Promise<any>> = [
      // 1. Yahoo Finance RSS
      fetchRssFeed(
        `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${encodedTicker}`,
        "Yahoo Finance"
      ),
      // 2. Google News RSS search
      fetchRssFeed(
        `https://news.google.com/rss/search?q=${encodeURIComponent(cleanSearchTicker + " stock OR earnings OR shares")}&hl=en-US&gl=US&ceid=US:en`,
        "Google News"
      ),
    ];

    // 3. SEC EDGAR Atom feed for regular equity symbols (skip indices or commodities like ^GSPC, USO, GLD)
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
    // Limit to top 30 most recent items
    const finalArticles = deduped.slice(0, 30);

    return res.status(200).json({
      ticker,
      count: finalArticles.length,
      articles: finalArticles,
      fetchedAt: new Date().toISOString(),
    });
  } catch (err: any) {
    console.error("Error in /api/news:", err);
    return res.status(500).json({
      error: "Failed to fetch ticker news feeds",
      details: err?.message || String(err),
    });
  }
}
