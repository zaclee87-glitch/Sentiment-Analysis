import React, { useCallback, useEffect, useRef, useState } from "react";
import { HeaderBar } from "./components/HeaderBar";
import { ImportExportModal } from "./components/ImportExportModal";
import { MarketDriversModal } from "./components/MarketDriversModal";
import { TickerDetailPanel } from "./components/TickerDetailPanel";
import { WatchlistPanel } from "./components/WatchlistPanel";
import {
  Article,
  MarketDriver,
  MarketGaugeData,
  RatingBadge,
  TickerData,
  TimeWindow,
} from "./types/terminal";
import {
  calculateDecayedScore,
  calculateMarketGauge,
  filterArticlesByWindow,
} from "./utils/scoring";
import {
  exportWatchlistToJson,
  getScoresCache,
  getStoredWatchlist,
  getSummaryCache,
  saveScoresToCache,
  saveSummaryToCache,
  saveWatchlist,
} from "./utils/storage";

export default function App() {
  const [watchlist, setWatchlist] = useState<TickerData[]>(() => getStoredWatchlist());
  const [selectedTicker, setSelectedTicker] = useState<string>(() => {
    const initial = getStoredWatchlist();
    return initial[0]?.symbol || "NVDA";
  });
  const [timeWindow, setTimeWindow] = useState<TimeWindow>("7D");
  const [marketGauge, setMarketGauge] = useState<MarketGaugeData | null>(null);

  const [isRefreshingAll, setIsRefreshingAll] = useState(false);
  const [refreshProgress, setRefreshProgress] = useState<{
    current: number;
    total: number;
    ticker?: string;
  } | null>(null);

  const [loadingTickers, setLoadingTickers] = useState<Set<string>>(new Set());
  const [loadingSummaries, setLoadingSummaries] = useState<Set<string>>(new Set());
  const [rateLimitWarning, setRateLimitWarning] = useState<string | null>(null);

  const [isDriversModalOpen, setIsDriversModalOpen] = useState(false);
  const [isImportExportModalOpen, setIsImportExportModalOpen] = useState(false);

  // Keep a ref of watchlist for access in async batch loops without stale state
  const watchlistRef = useRef(watchlist);
  watchlistRef.current = watchlist;

  // Persist watchlist whenever it changes
  useEffect(() => {
    saveWatchlist(watchlist);
  }, [watchlist]);

  // Recalculate ticker scores whenever time window changes
  useEffect(() => {
    setWatchlist((prev) =>
      prev.map((item) => {
        if (item.articles.length === 0) return item;
        const windowArts = filterArticlesByWindow(item.articles, timeWindow);
        const { score, rating } = calculateDecayedScore(windowArts);
        return {
          ...item,
          score,
          rating,
        };
      })
    );
  }, [timeWindow]);

  /**
   * Recalculate top market drivers and blended gauge
   */
  const updateMarketGaugeData = useCallback(
    (marketArticles: Article[], currentWatchlist: TickerData[]) => {
      const watchlistScores = currentWatchlist
        .filter((w) => w.articleCount > 0)
        .map((w) => w.score);

      const gauge = calculateMarketGauge(marketArticles, watchlistScores);

      // Extract all scored articles across market news and watchlist for drivers
      const allScoredArticles: Array<{
        title: string;
        source: string;
        score: number;
        ticker?: string;
        url?: string;
      }> = [];

      marketArticles.forEach((art) => {
        if (typeof art.score === "number") {
          allScoredArticles.push({
            title: art.title,
            source: art.source,
            score: art.score,
            ticker: "MACRO",
            url: art.url,
          });
        }
      });

      currentWatchlist.forEach((t) => {
        t.articles.forEach((art) => {
          if (typeof art.score === "number") {
            allScoredArticles.push({
              title: art.title,
              source: art.source,
              score: art.score,
              ticker: t.symbol,
              url: art.url,
            });
          }
        });
      });

      const bullishDrivers: MarketDriver[] = [...allScoredArticles]
        .sort((a, b) => b.score - a.score)
        .filter((a) => a.score > 0.1)
        .slice(0, 3);

      const bearishDrivers: MarketDriver[] = [...allScoredArticles]
        .sort((a, b) => a.score - b.score)
        .filter((a) => a.score < -0.1)
        .slice(0, 3);

      setMarketGauge({
        score: gauge.score,
        label: gauge.label,
        marketNewsScore: gauge.marketNewsScore,
        watchlistScore: gauge.watchlistScore,
        bullishDrivers,
        bearishDrivers,
        lastRefreshed: Date.now(),
        marketArticles,
      });
    },
    []
  );

  /**
   * Refresh a single ticker's news, earnings, and sentiment
   */
  const refreshSingleTicker = useCallback(
    async (symbol: string): Promise<TickerData | null> => {
      setLoadingTickers((prev) => new Set(prev).add(symbol));
      setRateLimitWarning(null);

      try {
        // Step 1: Fetch news articles and earnings in parallel
        const [newsRes, earningsRes] = await Promise.allSettled([
          fetch(`/api/news?ticker=${encodeURIComponent(symbol)}`).then((r) => {
            if (r.status === 429) throw new Error("429 Rate Limit Exceeded");
            return r.json();
          }),
          fetch(`/api/earnings?ticker=${encodeURIComponent(symbol)}`).then((r) => {
            if (r.status === 429) throw new Error("429 Rate Limit Exceeded");
            return r.json();
          }),
        ]);

        const rawArticles: Article[] =
          newsRes.status === "fulfilled" && Array.isArray(newsRes.value?.articles)
            ? newsRes.value.articles
            : [];

        const earningsData =
          earningsRes.status === "fulfilled" ? earningsRes.value : null;

        // Step 2: Sentiment scoring with localStorage caching
        const scoreCache = getScoresCache();
        const unscoredArticles: Article[] = [];
        const enrichedArticles: Article[] = [];

        for (const art of rawArticles) {
          const cached = scoreCache[art.id];
          if (cached) {
            enrichedArticles.push({
              ...art,
              ticker: symbol,
              label: cached.label,
              score: cached.score,
              rationale: cached.rationale,
              relevance: cached.relevance,
            });
          } else {
            unscoredArticles.push(art);
          }
        }

        // If there are unscored articles, batch them into ONE Gemini call via /api/sentiment
        if (unscoredArticles.length > 0) {
          const sentRes = await fetch("/api/sentiment", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              ticker: symbol,
              articles: unscoredArticles,
            }),
          });

          if (sentRes.status === 429) {
            setRateLimitWarning("Gemini API rate limit reached (429). Retrying with backoff.");
            throw new Error("429 Rate Limit Exceeded");
          }

          if (sentRes.ok) {
            const sentData = await sentRes.json();
            if (sentData.warning) {
              setRateLimitWarning(sentData.warning);
            }

            const scoresMap = new Map<string, any>();
            (sentData.scores || []).forEach((s: any) => {
              if (s.id) scoresMap.set(s.id, s);
            });

            const newCachedScores: Record<string, any> = {};

            unscoredArticles.forEach((art) => {
              const s = scoresMap.get(art.id);
              if (s) {
                const item = {
                  ...art,
                  ticker: symbol,
                  label: s.label,
                  score: s.score,
                  rationale: s.rationale,
                  relevance: s.relevance,
                };
                enrichedArticles.push(item);

                newCachedScores[art.id] = {
                  label: s.label,
                  score: s.score,
                  rationale: s.rationale,
                  relevance: s.relevance,
                  cachedAt: Date.now(),
                };
              } else {
                enrichedArticles.push(art);
              }
            });

            saveScoresToCache(newCachedScores);
          } else {
            const errData = await sentRes.json().catch(() => ({}));
            const msg = errData.details || errData.error || `Sentiment API failed (${sentRes.status})`;
            setRateLimitWarning(msg);
            unscoredArticles.forEach((a) => enrichedArticles.push(a));
          }
        }

        // Step 3: Compute recency-decayed score for current window
        const windowArts = filterArticlesByWindow(enrichedArticles, timeWindow);
        const { score, rating } = calculateDecayedScore(windowArts);

        // Check if summary is in cache
        const summaryCache = getSummaryCache();
        const existingSummary = summaryCache[symbol] || null;

        const updatedTicker: TickerData = {
          symbol,
          name:
            watchlistRef.current.find((w) => w.symbol === symbol)?.name || symbol,
          type:
            watchlistRef.current.find((w) => w.symbol === symbol)?.type ||
            (symbol.startsWith("^") ? "index" : "stock"),
          score,
          rating,
          articleCount: enrichedArticles.length,
          nextEarnings: earningsData?.nextEarningsDate || null,
          earningsDaysAway:
            typeof earningsData?.daysAway === "number" ? earningsData.daysAway : null,
          earningsSource: earningsData?.source || null,
          lastRefreshed: Date.now(),
          status: "done",
          error: null,
          articles: enrichedArticles,
          summary: existingSummary,
        };

        // Update watchlist state
        setWatchlist((prev) =>
          prev.map((item) => (item.symbol === symbol ? updatedTicker : item))
        );

        return updatedTicker;
      } catch (err: any) {
        console.error(`Error refreshing ${symbol}:`, err);
        setWatchlist((prev) =>
          prev.map((item) =>
            item.symbol === symbol
              ? {
                  ...item,
                  status: "error",
                  error: err?.message || "Failed to refresh",
                }
              : item
          )
        );
        return null;
      } finally {
        setLoadingTickers((prev) => {
          const next = new Set(prev);
          next.delete(symbol);
          return next;
        });
      }
    },
    [timeWindow]
  );

  /**
   * Refresh Perplexity-style AI Summary with Google Search Grounding for a ticker
   */
  const refreshTickerSummary = useCallback(async (symbol: string) => {
    setLoadingSummaries((prev) => new Set(prev).add(symbol));
    setRateLimitWarning(null);

    try {
      const res = await fetch(`/api/summary?ticker=${encodeURIComponent(symbol)}`);
      if (res.status === 429) {
        setRateLimitWarning("Gemini API rate limit reached (429). Retrying with backoff.");
        throw new Error("429 Rate Limit");
      }

      if (!res.ok) {
        throw new Error(`Summary API returned ${res.status}`);
      }

      const data = await res.json();
      const summaryObj = {
        ticker: symbol,
        summary: data.summary,
        citations: data.citations || [],
        generatedAt: data.generatedAt || Date.now(),
      };

      saveSummaryToCache(symbol, summaryObj);

      setWatchlist((prev) =>
        prev.map((item) =>
          item.symbol === symbol ? { ...item, summary: summaryObj } : item
        )
      );
    } catch (err: any) {
      console.error(`Error generating summary for ${symbol}:`, err);
    } finally {
      setLoadingSummaries((prev) => {
        const next = new Set(prev);
        next.delete(symbol);
        return next;
      });
    }
  }, []);

  /**
   * Refresh ALL tickers sequentially with progress reporting
   */
  const handleRefreshAll = useCallback(async () => {
    if (isRefreshingAll) return;
    setIsRefreshingAll(true);
    setRateLimitWarning(null);

    const list = [...watchlistRef.current];
    setRefreshProgress({ current: 0, total: list.length });

    try {
      // Step A: Refresh Market News in parallel
      const marketNewsPromise = fetch("/api/market-news")
        .then((r) => r.json())
        .then(async (data) => {
          const articles: Article[] = data.articles || [];
          // Score market news if needed
          const scoreCache = getScoresCache();
          const unscored = articles.filter((a) => !scoreCache[a.id]);

          if (unscored.length > 0) {
            try {
              const sentRes = await fetch("/api/sentiment", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ticker: "MACRO", articles: unscored }),
              });
              if (sentRes.ok) {
                const sentData = await sentRes.json();
                const scoresMap = new Map<string, any>();
                (sentData.scores || []).forEach((s: any) => scoresMap.set(s.id, s));
                const newScores: Record<string, any> = {};

                const scoredMarket = articles.map((art) => {
                  const s = scoresMap.get(art.id);
                  if (s) {
                    newScores[art.id] = {
                      label: s.label,
                      score: s.score,
                      rationale: s.rationale,
                      relevance: s.relevance,
                      cachedAt: Date.now(),
                    };
                    return { ...art, ...s };
                  }
                  return art;
                });
                saveScoresToCache(newScores);
                return scoredMarket;
              }
            } catch (err) {
              console.warn("Market news sentiment scoring error:", err);
            }
          }

          // Return with cached scores attached
          return articles.map((art) => {
            const cached = scoreCache[art.id];
            return cached ? { ...art, ...cached } : art;
          });
        })
        .catch((err) => {
          console.warn("Failed to fetch market news:", err);
          return [] as Article[];
        });

      // Step B: Process watchlist tickers sequentially
      const updatedList: TickerData[] = [];
      for (let i = 0; i < list.length; i++) {
        const item = list[i];
        setRefreshProgress({ current: i + 1, total: list.length, ticker: item.symbol });

        const updated = await refreshSingleTicker(item.symbol);
        if (updated) {
          updatedList.push(updated);
        } else {
          updatedList.push(item);
        }

        // Brief delay between tickers to respect free-tier RPM limits
        if (i < list.length - 1) {
          await new Promise((res) => setTimeout(res, 400));
        }
      }

      // Step C: Update Market Gauge with newly scored items
      const scoredMarketArticles = await marketNewsPromise;
      updateMarketGaugeData(scoredMarketArticles, updatedList);

      // Also ensure the currently selected ticker has a summary
      const currentSelected = updatedList.find((w) => w.symbol === selectedTicker);
      if (currentSelected && !currentSelected.summary) {
        refreshTickerSummary(currentSelected.symbol);
      }
    } finally {
      setIsRefreshingAll(false);
      setRefreshProgress(null);
    }
  }, [
    isRefreshingAll,
    refreshSingleTicker,
    refreshTickerSummary,
    selectedTicker,
    updateMarketGaugeData,
  ]);

  // Initial load: automatically score the initial default tickers if never loaded
  useEffect(() => {
    const hasUnrefreshed = watchlist.some((w) => w.lastRefreshed === null);
    if (hasUnrefreshed) {
      handleRefreshAll();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // When selected ticker changes, if no summary exists, generate it
  useEffect(() => {
    const cur = watchlist.find((w) => w.symbol === selectedTicker);
    if (cur && !cur.summary && cur.status !== "fetching") {
      const summaryCache = getSummaryCache();
      if (summaryCache[selectedTicker]) {
        setWatchlist((prev) =>
          prev.map((w) =>
            w.symbol === selectedTicker
              ? { ...w, summary: summaryCache[selectedTicker] }
              : w
          )
        );
      } else {
        refreshTickerSummary(selectedTicker);
      }
    }
  }, [selectedTicker, watchlist, refreshTickerSummary]);

  // Keyboard navigation for watchlist rows
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isDriversModalOpen || isImportExportModalOpen) {
        if (e.key === "Escape") {
          setIsDriversModalOpen(false);
          setIsImportExportModalOpen(false);
        }
        return;
      }

      // If active element is an input or textarea, don't hijack arrows
      if (
        document.activeElement?.tagName === "INPUT" ||
        document.activeElement?.tagName === "TEXTAREA"
      ) {
        return;
      }

      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const currentIndex = watchlist.findIndex((w) => w.symbol === selectedTicker);
        if (currentIndex === -1) return;

        if (e.key === "ArrowDown" && currentIndex < watchlist.length - 1) {
          setSelectedTicker(watchlist[currentIndex + 1].symbol);
        } else if (e.key === "ArrowUp" && currentIndex > 0) {
          setSelectedTicker(watchlist[currentIndex - 1].symbol);
        }
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [watchlist, selectedTicker, isDriversModalOpen, isImportExportModalOpen]);

  // Watchlist Actions: Add / Remove
  const handleAddTicker = (symbol: string) => {
    if (watchlist.length >= 100) return;
    const exists = watchlist.some((w) => w.symbol === symbol);
    if (exists) {
      setSelectedTicker(symbol);
      return;
    }

    const newTicker: TickerData = {
      symbol,
      name: symbol,
      type: symbol.startsWith("^") ? "index" : "stock",
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
    };

    setWatchlist((prev) => [newTicker, ...prev]);
    setSelectedTicker(symbol);
    refreshSingleTicker(symbol);
  };

  const handleRemoveTicker = (symbol: string) => {
    setWatchlist((prev) => {
      const filtered = prev.filter((w) => w.symbol !== symbol);
      if (symbol === selectedTicker && filtered.length > 0) {
        setSelectedTicker(filtered[0].symbol);
      }
      return filtered;
    });
  };

  const selectedTickerData =
    watchlist.find((w) => w.symbol === selectedTicker) || null;

  return (
    <div className="flex flex-col h-screen w-screen bg-black text-zinc-100 overflow-hidden font-mono antialiased">
      {/* Top Header with Bloomberg Terminal Bar, Market Gauge & Refresh */}
      <HeaderBar
        marketGauge={marketGauge}
        timeWindow={timeWindow}
        setTimeWindow={setTimeWindow}
        isRefreshingAll={isRefreshingAll}
        refreshProgress={refreshProgress}
        onRefreshAll={handleRefreshAll}
        onOpenImport={() => setIsImportExportModalOpen(true)}
        onExport={() => exportWatchlistToJson(watchlist)}
        onOpenDrivers={() => setIsDriversModalOpen(true)}
        rateLimitWarning={rateLimitWarning}
      />

      {/* Main Two-Panel Layout (Left: Watchlist, Right: Ticker Detail) */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Panel: Dense Watchlist Table (approx 440px width) */}
        <div className="w-[440px] xl:w-[480px] shrink-0 h-full flex flex-col">
          <WatchlistPanel
            watchlist={watchlist}
            selectedTicker={selectedTicker}
            onSelectTicker={setSelectedTicker}
            onAddTicker={handleAddTicker}
            onRemoveTicker={handleRemoveTicker}
            onRefreshTicker={refreshSingleTicker}
            isProcessing={isRefreshingAll}
          />
        </div>

        {/* Right Panel: Ticker Detail, AI Catalyst Summary & Article Feed */}
        <div className="flex-1 h-full overflow-hidden flex flex-col">
          <TickerDetailPanel
            tickerData={selectedTickerData}
            timeWindow={timeWindow}
            onRefreshTicker={refreshSingleTicker}
            onRefreshSummary={refreshTickerSummary}
            isSummaryLoading={loadingSummaries.has(selectedTicker)}
            isTickerLoading={loadingTickers.has(selectedTicker)}
          />
        </div>
      </div>

      {/* Market Drivers Modal */}
      <MarketDriversModal
        isOpen={isDriversModalOpen}
        onClose={() => setIsDriversModalOpen(false)}
        marketGauge={marketGauge}
      />

      {/* Watchlist Import / Export Modal */}
      <ImportExportModal
        isOpen={isImportExportModalOpen}
        onClose={() => setIsImportExportModalOpen(false)}
        watchlist={watchlist}
        onImportWatchlist={(newList) => {
          setWatchlist(newList);
          if (newList.length > 0) {
            setSelectedTicker(newList[0].symbol);
          }
        }}
      />
    </div>
  );
}
