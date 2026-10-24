import { Type } from "@google/genai";
import type { Request, Response } from "express";
import { callWithRetry, getGeminiClient } from "./_lib/gemini.js";

interface ArticleInput {
  id: string;
  title: string;
  snippet: string;
  publishedTime: string;
  source: string;
}

export default async function handler(req: Request | any, res: Response | any) {
  try {
    const { ticker, articles } = (req.body || {}) as {
      ticker: string;
      articles: ArticleInput[];
    };

    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker parameter in request body" });
    }

    if (!Array.isArray(articles) || articles.length === 0) {
      return res.status(200).json({ ticker, scores: [] });
    }

    const ai = getGeminiClient();

    // Prepare compact prompt payload to maximize speed and token efficiency
    const articlesSummary = articles.map((a, i) => ({
      index: i,
      id: a.id,
      title: a.title,
      source: a.source,
      publishedTime: a.publishedTime,
      snippet: a.snippet?.slice(0, 240) || "",
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

    const prompt = `Analyze the sentiment and material impact of the following ${articles.length} news items for asset "${ticker}".
Judge strictly from the perspective of an institutional stock investor with an 8-12 week investment horizon:
- Prioritize: guidance revisions, earnings estimates, margin trajectory, demand/supply shocks, major contracts, regulatory actions, and macro regime changes.
- Downweight or label neutral: short-term market noise, generic listicles, clickbait headlines, automated technical recap summaries, and duplicate wire reports.
- Score: -1.0 (maximum bearish) to +1.0 (maximum bullish), with 0.0 being balanced/neutral.
- Relevance: 0.0 to 1.0 (1.0 = asset is the sole focus; 0.2 = asset is merely mentioned in passing).

Articles:
${JSON.stringify(articlesSummary, null, 2)}`;

    const response = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: prompt,
        config: {
          systemInstruction:
            "You are an elite quantitative financial analyst and portfolio manager. Output strict structured JSON adhering to the provided schema.",
          responseMimeType: "application/json",
          responseSchema,
          temperature: 0.2,
        },
      });
    });

    const rawText = response.text || "[]";
    let scores = [];
    try {
      scores = JSON.parse(rawText);
    } catch (parseErr) {
      console.error("JSON parse error for sentiment response:", rawText);
      throw new Error("Model returned invalid JSON structure");
    }

    return res.status(200).json({
      ticker,
      count: scores.length,
      scores,
    });
  } catch (err: any) {
    console.error("Error in /api/sentiment:", err);
    return res.status(500).json({
      error: "Failed to score article sentiments",
      details: err?.message || String(err),
    });
  }
}
