import type { Request, Response } from "express";
import { callWithRetry, getGeminiClient } from "./_lib/gemini.js";

export default async function handler(req: Request | any, res: Response | any) {
  try {
    const ticker = ((req.query?.ticker || req.body?.ticker || "") as string).trim().toUpperCase();

    if (!ticker) {
      return res.status(400).json({ error: "Missing ticker parameter" });
    }

    // Skip index / commodities / known ETFs with no earnings
    const nonEarningsAssets = ["^GSPC", "^DJI", "^IXIC", "GLD", "USO", "SPY", "QQQ", "IWM", "VTI"];
    if (nonEarningsAssets.includes(ticker) || ticker.startsWith("^")) {
      return res.status(200).json({
        ticker,
        nextEarningsDate: null,
        daysAway: null,
        source: "not_applicable",
        isWithin7Days: false,
      });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    // Method 1: Check Finnhub if FINNHUB_API_KEY is configured
    const finnhubKey = process.env.FINNHUB_API_KEY;
    if (finnhubKey) {
      try {
        const nextYear = new Date();
        nextYear.setFullYear(nextYear.getFullYear() + 1);
        const nextYearStr = nextYear.toISOString().split("T")[0];

        const finnhubRes = await fetch(
          `https://finnhub.io/api/v1/calendar/earnings?symbol=${encodeURIComponent(ticker)}&from=${todayStr}&to=${nextYearStr}&token=${finnhubKey}`
        );

        if (finnhubRes.ok) {
          const data: any = await finnhubRes.json();
          const calendar = data?.earningsCalendar;
          if (Array.isArray(calendar) && calendar.length > 0) {
            // Find earliest date >= today
            const future = calendar
              .filter((item: any) => item.date && item.date >= todayStr)
              .sort((a: any, b: any) => a.date.localeCompare(b.date));

            if (future.length > 0 && future[0].date) {
              const nextDate = future[0].date;
              const daysAway = Math.round(
                (new Date(nextDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
              );

              return res.status(200).json({
                ticker,
                nextEarningsDate: nextDate,
                daysAway,
                source: "finnhub",
                isWithin7Days: daysAway >= 0 && daysAway <= 7,
              });
            }
          }
        }
      } catch (finnhubErr) {
        console.warn("Finnhub earnings calendar lookup failed, falling back to Gemini Search Grounding:", finnhubErr);
      }
    }

    // Method 2: Fallback to Gemini 3.8 Flash with Google Search Grounding
    const ai = getGeminiClient();

    const result = await callWithRetry(async () => {
      return await ai.models.generateContent({
        model: "gemini-3.8-flash",
        contents: `What is the exact next confirmed or consensus estimated quarterly earnings release date for ${ticker}? Today's date is ${todayStr}. If ${ticker} does not report earnings (e.g. index/ETF), reply with NONE. Otherwise output format strictly: DATE: YYYY-MM-DD`,
        config: {
          tools: [{ googleSearch: {} }],
        },
      });
    });

    const responseText = result.text || "";
    const dateMatch = responseText.match(/\b(202\d-[01]\d-[0-3]\d)\b/);

    if (dateMatch) {
      const nextDate = dateMatch[1];
      const daysAway = Math.round(
        (new Date(nextDate).getTime() - new Date(todayStr).getTime()) / (1000 * 60 * 60 * 24)
      );

      return res.status(200).json({
        ticker,
        nextEarningsDate: nextDate,
        daysAway,
        source: "gemini-search-grounding",
        isWithin7Days: daysAway >= 0 && daysAway <= 7,
      });
    }

    return res.status(200).json({
      ticker,
      nextEarningsDate: null,
      daysAway: null,
      source: "gemini-search-grounding",
      isWithin7Days: false,
    });
  } catch (err: any) {
    console.error("Error in /api/earnings:", err);
    return res.status(200).json({
      ticker: (req.query?.ticker || req.body?.ticker || "") as string,
      nextEarningsDate: null,
      daysAway: null,
      source: "unavailable",
      isWithin7Days: false,
      error: err?.message || String(err),
    });
  }
}
