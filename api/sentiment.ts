import { Type } from "@google/genai";
import type { Request, Response } from "express";
import { getGeminiClient } from "./_lib/gemini.js";

interface ArticleInput {
  id: string;
  title: string;
  snippet: string;
  publishedTime: string;
  source: string;
}

interface SentimentResult {
  id: string;
  label: "bullish" | "neutral" | "bearish";
  score: number;
  rationale: string;
  relevance: number;
}

/**
 * High-precision quantitative financial sentiment heuristic fallback.
 * Used if Gemini API key is missing or when Gemini encounters 429/503 spikes.
 */
function heuristicFinancialSentiment(
  ticker: string,
  article: ArticleInput
): SentimentResult {
  const text = `${article.title} ${article.snippet}`.toLowerCase();
  const cleanTicker = ticker.toLowerCase().replace(/^\^/, "");

  const strongBull = [
    "surge", "surges", "surging", "jumps", "jumped", "soars", "soaring", "record revenue",
    "blowout", "beat earnings", "beats", "raises guidance", "raised guidance", "upgrade",
    "upgraded", "outperform", "buy rating", "strong buy", "breakout", "rally", "rallies",
    "all-time high", "profit surges", "dividend increase", "share buyback", "billion"
  ];
  const modBull = [
    "gains", "rises", "rising", "higher", "growth", "positive", "rebound", "recovery",
    "expansion", "optimism", "partners with", "secures contract", "upbeat", "bullish"
  ];

  const strongBear = [
    "plunge", "plunges", "plunging", "slump", "slumps", "crashes", "crash", "tumbles",
    "tumbled", "misses", "missed earnings", "cuts guidance", "lowered guidance", "downgrade",
    "downgraded", "underperform", "sell rating", "investigation", "lawsuit", "subpoena",
    "sec probe", "fraud", "layoffs", "default", "bankruptcy", "warning", "catastrophic"
  ];
  const modBear = [
    "drops", "dropped", "declines", "declining", "lower", "losses", "loss", "concerns",
    "cautious", "fears", "pressure", "headwinds", "inflation risk", "bearish", "weakness"
  ];

  let rawScore = 0;
  let rationale = "Balanced financial press wire with neutral market implications.";

  for (const w of strongBull) {
    if (text.includes(w)) {
      rawScore += 0.55;
      rationale = `Positive momentum catalyst detected: mentions '${w}'.`;
      break;
    }
  }
  for (const w of modBull) {
    if (text.includes(w)) {
      rawScore += 0.25;
      if (rationale.startsWith("Balanced")) {
        rationale = `Favorable business development noted: '${w}'.`;
      }
      break;
    }
  }

  for (const w of strongBear) {
    if (text.includes(w)) {
      rawScore -= 0.60;
      rationale = `Material downside catalyst flagged: mentions '${w}'.`;
      break;
    }
  }
  for (const w of modBear) {
    if (text.includes(w)) {
      rawScore -= 0.25;
      if (!rationale.includes("downside")) {
        rationale = `Market headwind or cautionary indicator: '${w}'.`;
      }
      break;
    }
  }

  // Bound score
  const score = Math.max(-1.0, Math.min(1.0, Math.round(rawScore * 100) / 100));
  let label: "bullish" | "neutral" | "bearish" = "neutral";
  if (score >= 0.20) label = "bullish";
  else if (score <= -0.20) label = "bearish";

  // Relevance heuristic: 0.95 if ticker is explicitly in headline, 0.8 if in snippet, 0.4 if general
  const titleLower = article.title.toLowerCase();
  let relevance = 0.5;
  if (titleLower.includes(cleanTicker) || (ticker === "NVDA" && titleLower.includes("nvidia"))) {
    relevance = 0.95;
  } else if (text.includes(cleanTicker)) {
    relevance = 0.75;
  }

  return {
    id: article.id,
    label,
    score,
    rationale,
    relevance,
  };
}

export default async function handler(req: Request | any, res: Response | any) {
  try {
    // Robust body parsing across Express, Node.js, and Vercel serverless runtimes
    let body = req.body;
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch {
        body = {};
      }
    } else if (Buffer.isBuffer(body)) {
      try {
        body = JSON.parse(body.toString("utf-8"));
      } catch {
        body = {};
      }
    }

    const { ticker, articles } = (body || {}) as {
      ticker: string;
      articles: ArticleInput[];
    };

    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker parameter in request body" });
    }

    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(200).json({ ticker, scores: [] });
    }

    // Limit batch size to top 15 most recent articles to prevent Vercel 10s serverless timeout
    const targetArticles = articles.slice(0, 15);

    // Attempt Gemini 3.8 Flash structured output
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("[Sentiment API] GEMINI_API_KEY is not configured in environment. Using quantitative heuristic fallback.");
      const fallbackScores = articles.map((a) => heuristicFinancialSentiment(ticker, a));
      return res.status(200).json({
        ticker,
        count: fallbackScores.length,
        scores: fallbackScores,
        provider: "heuristic-fallback",
        warning: "GEMINI_API_KEY is missing in Vercel. Using quantitative heuristic fallback.",
      });
    }

    try {
      const ai = getGeminiClient();

      const articlesSummary = targetArticles.map((a, i) => ({
        index: i,
        id: a.id,
        title: a.title,
        source: a.source,
        publishedTime: a.publishedTime,
        snippet: a.snippet?.slice(0, 200) || "",
      }));

      const responseSchema = {
        type: Type.ARRAY,
        description: "Array of sentiment ratings for each news article",
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description: "The unique article id matching the input article id",
            },
            label: {
              type: Type.STRING,
              enum: ["bullish", "neutral", "bearish"],
              description: "Categorical sentiment classification",
            },
            score: {
              type: Type.NUMBER,
              description: "Sentiment score from -1.0 (deeply bearish) to +1.0 (strongly bullish)",
            },
            rationale: {
              type: Type.STRING,
              description: "A single concise, high-density rationale explaining the score from an investor viewpoint",
            },
            relevance: {
              type: Type.NUMBER,
              description: "Relevance score from 0.0 to 1.0 indicating how directly this article materially affects this asset",
            },
          },
          required: ["id", "label", "score", "rationale", "relevance"],
        },
      };

      const prompt = `Analyze sentiment and material price impact for ${targetArticles.length} news items for ticker "${ticker}".
Horizon: 8-12 weeks. Score -1.0 to +1.0, relevance 0.0 to 1.0.
Articles:
${JSON.stringify(articlesSummary)}`;

      // Execute Gemini call with 6s timeout to avoid Vercel serverless lag
      const geminiPromise = ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "You are an elite quantitative financial analyst. Output strict structured JSON adhering to the provided schema.",
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.1,
        },
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Gemini API call timed out after 6s")), 6000)
      );

      const response: any = await Promise.race([geminiPromise, timeoutPromise]);
      const rawText = response.text || "[]";
      const scores = JSON.parse(rawText);

      // Score any remaining articles (if more than 15) using heuristic so nothing is left unscored
      if (articles.length > 15) {
        const remaining = articles.slice(15).map((a) => heuristicFinancialSentiment(ticker, a));
        scores.push(...remaining);
      }

      return res.status(200).json({
        ticker,
        count: scores.length,
        scores,
        provider: "gemini-3.8-flash",
      });
    } catch (geminiErr: any) {
      console.warn(`[Sentiment API] Gemini scoring failed (${geminiErr.message}). Switching to quantitative heuristic fallback.`);
      
      const fallbackScores = articles.map((a) => heuristicFinancialSentiment(ticker, a));
      return res.status(200).json({
        ticker,
        count: fallbackScores.length,
        scores: fallbackScores,
        provider: "heuristic-fallback",
        warning: `Gemini API temporary issue (${geminiErr.message || "503/429"}). Scored using quantitative heuristic fallback.`,
      });
    }
  } catch (err: any) {
    console.error("Critical error in /api/sentiment:", err);
    return res.status(500).json({
      error: "Failed to score article sentiments",
      details: err?.message || String(err),
    });
  }
}
