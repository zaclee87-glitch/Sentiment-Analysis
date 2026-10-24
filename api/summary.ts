import type { Request, Response } from "express";
import { callWithRetry, getGeminiClient } from "./_lib/gemini.js";

export default async function handler(req: Request | any, res: Response | any) {
  try {
    const ticker = ((req.query?.ticker || req.body?.ticker || "") as string).trim().toUpperCase();

    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker parameter" });
    }

    const ai = getGeminiClient();
    const todayStr = new Date().toISOString().split("T")[0];

    const prompt = `Provide an authoritative, high-density financial briefing answering: "Why is ${ticker} moving right now?"
Current date context: ${todayStr}.
Requirements:
1. Synthesize recent price action, fundamental catalysts (earnings, guidance, backlog, margins), macro policy, industry shifts, and Wall Street upgrades/downgrades.
2. Exactly 4 to 6 concise, analytical sentences.
3. Adopt a direct, institutional tone (like Bloomberg Intelligence / Perplexity Finance). No preamble, no "In conclusion", and no disclaimer.
4. Ground your analysis in recent live web search results.`;

    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
    });

    const summaryText = response.text?.trim() || `No recent catalyst summary available for ${ticker}.`;

    // Extract grounding citations from candidate metadata
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
      generatedAt: Date.now(),
    });
  } catch (err: any) {
    console.error("Error in /api/summary:", err);
    return res.status(500).json({
      error: "Failed to generate ticker catalyst summary",
      details: err?.message || String(err),
    });
  }
}
