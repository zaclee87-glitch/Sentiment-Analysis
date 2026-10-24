import { Article, AISummary, TickerData } from "../types/terminal";

const WATCHLIST_STORAGE_KEY = "aura_terminal_watchlist_v1";
const SCORES_CACHE_KEY = "aura_terminal_scores_cache_v1";
const SUMMARIES_CACHE_KEY = "aura_terminal_summaries_cache_v1";

export const DEFAULT_TICKERS: Array<{
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'index' | 'commodity';
}> = [
  { symbol: "NVDA", name: "NVIDIA Corporation", type: "stock" },
  { symbol: "AAPL", name: "Apple Inc.", type: "stock" },
  { symbol: "MSFT", name: "Microsoft Corporation", type: "stock" },
  { symbol: "TSLA", name: "Tesla, Inc.", type: "stock" },
  { symbol: "SPY", name: "SPDR S&P 500 ETF Trust", type: "etf" },
  { symbol: "GLD", name: "SPDR Gold Shares", type: "commodity" },
  { symbol: "USO", name: "United States Oil Fund", type: "commodity" },
  { symbol: "^GSPC", name: "S&P 500 Index", type: "index" },
];

export function getStoredWatchlist(): TickerData[] {
  try {
    const raw = localStorage.getItem(WATCHLIST_STORAGE_KEY);
    if (!raw) return createInitialWatchlist();
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
  } catch (err) {
    console.warn("Error reading watchlist from localStorage:", err);
  }
  return createInitialWatchlist();
}

export function saveWatchlist(watchlist: TickerData[]): void {
  try {
    localStorage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(watchlist));
  } catch (err) {
    console.warn("Error saving watchlist to localStorage:", err);
  }
}

export function createInitialWatchlist(): TickerData[] {
  return DEFAULT_TICKERS.map((t) => ({
    symbol: t.symbol,
    name: t.name,
    type: t.type,
    score: 0,
    rating: "NEUTRAL",
    articleCount: 0,
    nextEarnings: null,
    earningsDaysAway: null,
    earningsSource: null,
    lastRefreshed: null,
    status: "idle",
    error: null,
    articles: [],
    summary: null,
  }));
}

// ================= Article Sentiment Score Cache =================

export interface CachedScore {
  label: "bullish" | "neutral" | "bearish";
  score: number;
  rationale: string;
  relevance: number;
  cachedAt: number;
}

export function getScoresCache(): Record<string, CachedScore> {
  try {
    const raw = localStorage.getItem(SCORES_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveScoresToCache(scores: Record<string, CachedScore>): void {
  try {
    const current = getScoresCache();
    const updated = { ...current, ...scores };
    // Cap cache at 2000 entries to prevent localStorage bloating
    const keys = Object.keys(updated);
    if (keys.length > 2000) {
      const trimmed: Record<string, CachedScore> = {};
      keys.slice(-1500).forEach((k) => {
        trimmed[k] = updated[k];
      });
      localStorage.setItem(SCORES_CACHE_KEY, JSON.stringify(trimmed));
    } else {
      localStorage.setItem(SCORES_CACHE_KEY, JSON.stringify(updated));
    }
  } catch (err) {
    console.warn("Failed to persist score cache:", err);
  }
}

// ================= AISummary Cache =================

export function getSummaryCache(): Record<string, AISummary> {
  try {
    const raw = localStorage.getItem(SUMMARIES_CACHE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export function saveSummaryToCache(ticker: string, summary: AISummary): void {
  try {
    const current = getSummaryCache();
    current[ticker] = summary;
    localStorage.setItem(SUMMARIES_CACHE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn("Failed to save summary cache:", err);
  }
}

// ================= Export & Import =================

export function exportWatchlistToJson(watchlist: TickerData[]): void {
  const exportData = {
    exportedAt: new Date().toISOString(),
    version: 1,
    tickers: watchlist.map((w) => ({
      symbol: w.symbol,
      name: w.name,
      type: w.type,
      score: w.score,
      rating: w.rating,
      nextEarnings: w.nextEarnings,
    })),
  };

  const blob = new Blob([JSON.stringify(exportData, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `aura-terminal-watchlist-${new Date().toISOString().split("T")[0]}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export function parseImportedJson(jsonText: string): TickerData[] | null {
  try {
    const parsed = JSON.parse(jsonText);
    const list = Array.isArray(parsed) ? parsed : parsed.tickers;
    if (!Array.isArray(list)) return null;

    const validated: TickerData[] = [];
    const seen = new Set<string>();

    for (const item of list) {
      if (typeof item?.symbol === "string" && item.symbol.trim()) {
        const symbol = item.symbol.trim().toUpperCase();
        if (!seen.has(symbol) && validated.length < 100) {
          seen.add(symbol);
          validated.push({
            symbol,
            name: item.name || symbol,
            type: item.type || (symbol.startsWith("^") ? "index" : "stock"),
            score: typeof item.score === "number" ? item.score : 0,
            rating: item.rating || "NEUTRAL",
            articleCount: 0,
            nextEarnings: item.nextEarnings || null,
            earningsDaysAway: null,
            earningsSource: null,
            lastRefreshed: null,
            status: "idle",
            error: null,
            articles: [],
            summary: null,
          });
        }
      }
    }
    return validated.length > 0 ? validated : null;
  } catch (err) {
    console.error("Invalid watchlist JSON import:", err);
    return null;
  }
}
