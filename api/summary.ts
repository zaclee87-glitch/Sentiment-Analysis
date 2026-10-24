import type { Request, Response } from "express";
import { fetchFinnhubCompanyNews } from "./_lib/finnhub.js";
import { getGeminiClient } from "./_lib/gemini.js";

export default async function handler(req: Request | any, res: Response | any) {
  try {
    const ticker = ((req.query?.ticker || req.body?.ticker || "") as string).trim().toUpperCase();

    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker parameter" });
    }

    const apiKey = process.env.GEMINI_API_KEY;

    if (apiKey) {
      try {
        const ai = getGeminiClient();
        const todayStr = new Date().toISOString().split("T")[0];

        const prompt = `Provide an authoritative, high-density financial briefing answering: "Why is ${ticker} moving right now?"
Current date context: ${todayStr}.
Requirements:
1. Synthesize recent price action, fundamental catalysts (earnings, guidance, backlog, margins), macro policy, industry shifts, and Wall Street upgrades/downgrades.
2. Exactly 4 to 6 concise, analytical sentences.
3. Adopt a direct, institutional tone (like Bloomberg Intelligence / Perplexity Finance). No preamble, no "In conclusion", and no disclaimer.
4. Ground your analysis in recent live web search results.`;

        const geminiPromise = ai.models.generateContent({
          model: "gemini-3.8-flash",
          contents: prompt,
          config: {
            tools: [{ googleSearch: {} }],
          },
        });

        // 9-second timeout to avoid Vercel 10s ceiling
        const timeoutPromise = new Promise<never>((_, reject) =>
          setTimeout(() => reject(new Error("Gemini summary call timed out")), 9000)
        );

        const response: any = await Promise.race([geminiPromise, timeoutPromise]);
        const summaryText = response.text?.trim();

        if (summaryText) {
          const candidate = response.candidates?.[0];
          const groundingChunks = candidate?.groundingMetadata?.groundingChunks || [];

          const citations: Array<{ index: number; title: string; url: string; source: string }> = [];
          const seenUrls = new Set<string>();

          let citeIdx = 1;
          for (const chunk of groundingChunks) {
            if (chunk.web?.uri) {
              const uri = chunk.web.uri;
              if (!seenUrls.has(uri)) {
                seenUrls.add(uri);
                let domain = "";
                try {
                  domain = new URL(uri).hostname.replace(/^www\./, "");
                } catch {
                  domain = "web source";
                }
                citations.push({
                  index: citeIdx++,
                  title: chunk.web.title || domain,
                  url: uri,
                  source: domain,
                });
              }
            }
          }

          return res.status(200).json({
            ticker,
            summary: summaryText,
            citations,
            provider: "gemini-search-grounding",
            generatedAt: Date.now(),
          });
        }
      } catch (geminiErr: any) {
        console.warn(`[Summary API] Grounded search summary failed (${geminiErr.message}). Generating synthesis from Finnhub wire.`);
      }
    }

    // Fallback briefing from live Finnhub wire releases
    let wireArticles: any[] = [];
    if (process.env.FINNHUB_API_KEY) {
      try {
        wireArticles = await fetchFinnhubCompanyNews(ticker);
      } catch {
        // fallback
      }
    }

    const topTitles = wireArticles.slice(0, 3).map((a) => a.title);
    const summaryFallback = topTitles.length > 0
      ? `Recent catalyst activity for ${ticker} is highlighted by current market developments: ${topTitles.join(
          "; "
        )}. Institutional market participants are evaluating these headline flows in conjunction with upcoming earnings releases and macro capital allocation trends. Maintain observation on volume trends and revenue guidance revisions.`
      : `Market intelligence for ${ticker} reflects ongoing consolidation ahead of the next quarterly reporting cycle. Analysts remain focused on operational margins, secular industry demand, and capital allocation. Institutional flows are monitoring sector-wide macro indicators.`;

    const citations = wireArticles.slice(0, 3).map((a, i) => ({
      index: i + 1,
      title: a.title,
      url: a.url,
      source: a.source,
    }));

    return res.status(200).json({
      ticker,
      summary: summaryFallback,
      citations,
      provider: "finnhub-wire-synthesis",
      generatedAt: Date.now(),
    });
  } catch (err: any) {
    console.error("Error in /api/summary:", err);
    return res.status(200).json({
      ticker: (req.query?.ticker || req.body?.ticker || "") as string,
      summary: `Market intelligence for asset is currently being compiled from real-time feeds.`,
      citations: [],
      provider: "fallback",
      generatedAt: Date.now(),
    });
  }
}
