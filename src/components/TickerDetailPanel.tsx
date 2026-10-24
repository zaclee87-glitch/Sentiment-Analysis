import React, { useState, useMemo } from "react";
import {
  Calendar,
  Clock,
  ExternalLink,
  Filter,
  Globe,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
} from "lucide-react";
import {
  Article,
  RatingBadge,
  SentimentLabel,
  TickerData,
  TimeWindow,
} from "../types/terminal";
import { filterArticlesByWindow, getRatingColor } from "../utils/scoring";

interface TickerDetailPanelProps {
  tickerData: TickerData | null;
  timeWindow: TimeWindow;
  onRefreshTicker: (symbol: string) => void;
  onRefreshSummary: (symbol: string) => void;
  isSummaryLoading: boolean;
  isTickerLoading: boolean;
}

export const TickerDetailPanel: React.FC<TickerDetailPanelProps> = ({
  tickerData,
  timeWindow,
  onRefreshTicker,
  onRefreshSummary,
  isSummaryLoading,
  isTickerLoading,
}) => {
  const [sentimentFilter, setSentimentFilter] = useState<"ALL" | SentimentLabel>("ALL");
  const [articleSearch, setArticleSearch] = useState("");

  if (!tickerData) {
    return (
      <div className="flex-1 flex items-center justify-center bg-black text-zinc-600 font-mono text-xs">
        <span>SELECT A TICKER FROM WATCHLIST TO INSPECT INTEL</span>
      </div>
    );
  }

  // Filter articles by window (24H, 7D, 30D)
  const windowArticles = filterArticlesByWindow(tickerData.articles, timeWindow);

  // Filter articles by sentiment tab and text query
  const displayedArticles = useMemo(() => {
    return windowArticles.filter((art) => {
      if (sentimentFilter !== "ALL" && art.label !== sentimentFilter) {
        return false;
      }
      if (articleSearch.trim()) {
        const q = articleSearch.toLowerCase();
        return (
          art.title.toLowerCase().includes(q) ||
          art.source.toLowerCase().includes(q) ||
          (art.rationale && art.rationale.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [windowArticles, sentimentFilter, articleSearch]);

  const bullishCount = windowArticles.filter((a) => a.label === "bullish").length;
  const neutralCount = windowArticles.filter((a) => a.label === "neutral").length;
  const bearishCount = windowArticles.filter((a) => a.label === "bearish").length;

  const colors = getRatingColor(tickerData.rating);
  const isWithin7Days =
    tickerData.earningsDaysAway !== null &&
    tickerData.earningsDaysAway >= 0 &&
    tickerData.earningsDaysAway <= 7;

  // Format relative last refreshed time
  const formatTimeAgo = (ts: number | null) => {
    if (!ts) return "NEVER";
    const diffSec = Math.round((Date.now() - ts) / 1000);
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  };

  const scoreMeterPercent = Math.min(
    100,
    Math.max(0, ((tickerData.score + 1) / 2) * 100)
  );

  return (
    <div className="flex-1 flex flex-col h-full bg-black overflow-y-auto font-mono text-zinc-200">
      {/* Ticker Header Banner */}
      <div className="border-b border-zinc-800 bg-zinc-950 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-black tracking-widest text-white">
              {tickerData.symbol}
            </h1>
            <span className="text-xs uppercase bg-zinc-900 border border-zinc-800 text-zinc-400 px-2 py-0.5 rounded">
              {tickerData.type}
            </span>
            <span className="text-xs text-zinc-400 font-sans hidden md:inline">
              {tickerData.name}
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[11px] text-zinc-500">
              UPDATED: {formatTimeAgo(tickerData.lastRefreshed)}
            </span>
            <button
              onClick={() => onRefreshTicker(tickerData.symbol)}
              disabled={isTickerLoading}
              className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 text-xs px-2.5 py-1 rounded transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isTickerLoading ? "animate-spin text-emerald-400" : ""}`} />
              <span>{isTickerLoading ? "UPDATING..." : "REFRESH"}</span>
            </button>
          </div>
        </div>

        {/* Rating & Metric Row */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-3 pt-3 border-t border-zinc-900">
          {/* Sentiment Rating & Gauge */}
          <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-wider">
              <span>SENTIMENT RATING</span>
              <span className="text-[9px] text-zinc-500">WINDOW: {timeWindow}</span>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span
                className={`text-xs font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${colors.text} ${colors.bg} ${colors.border}`}
              >
                {tickerData.rating}
              </span>
              <div className="flex items-baseline gap-1">
                <span className={`text-lg font-bold tabular-nums ${colors.text}`}>
                  {tickerData.score > 0 ? `+${tickerData.score.toFixed(2)}` : tickerData.score.toFixed(2)}
                </span>
                <span className="text-[10px] text-zinc-500">[-1.0 to +1.0]</span>
              </div>
            </div>
            {/* Visual gradient bar */}
            <div className="w-full h-1.5 bg-zinc-800 rounded-sm relative overflow-hidden mt-1 flex">
              <div className="w-1/3 h-full bg-rose-950/70" />
              <div className="w-1/3 h-full bg-amber-950/70" />
              <div className="w-1/3 h-full bg-emerald-950/70" />
              <div
                className="absolute top-0 bottom-0 w-1 bg-white shadow"
                style={{ left: `${scoreMeterPercent}%` }}
              />
            </div>
            <span className="text-[9px] text-zinc-500 mt-0.5">
              Relevance-weighted, recency-decayed (half-life: 3d)
            </span>
          </div>

          {/* Earnings Info Box */}
          <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded justify-between">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-wider">
              <span className="flex items-center gap-1">
                <Calendar className="w-3 h-3 text-zinc-500" />
                <span>NEXT EARNINGS REPORT</span>
              </span>
              <span className="text-[9px] text-zinc-500">
                {tickerData.earningsSource || "calendar"}
              </span>
            </div>

            <div className="flex items-center justify-between mt-1">
              <div>
                <span className="text-sm font-bold text-zinc-100">
                  {tickerData.nextEarnings || "NONE / UNCONFIRMED"}
                </span>
              </div>
              {isWithin7Days && (
                <div className="bg-amber-500/20 text-amber-300 border border-amber-500/60 px-2 py-0.5 rounded text-[10px] font-bold tracking-wider animate-pulse uppercase">
                  EARNINGS IN {tickerData.earningsDaysAway}D
                </div>
              )}
            </div>

            <span className="text-[9px] text-zinc-500">
              {isWithin7Days
                ? "High volatility expected within 7 days. Monitor guidance."
                : "Free Finnhub calendar / Gemini Search Grounded."}
            </span>
          </div>

          {/* Feed Stats */}
          <div className="flex flex-col gap-1 bg-zinc-900/60 border border-zinc-800/80 p-2.5 rounded justify-between">
            <div className="text-[10px] text-zinc-400 uppercase tracking-wider">
              <span>INTELLIGENCE COVERAGE</span>
            </div>
            <div className="flex items-center justify-between text-xs mt-1">
              <span className="text-zinc-300 font-bold">
                {windowArticles.length} ARTICLES ANALYZED
              </span>
              <div className="flex items-center gap-2 text-[10px]">
                <span className="text-emerald-400 font-bold">{bullishCount} BULL</span>
                <span className="text-amber-400 font-bold">{neutralCount} NEU</span>
                <span className="text-rose-400 font-bold">{bearishCount} BEAR</span>
              </div>
            </div>
            <span className="text-[9px] text-zinc-500">
              Source: Finnhub Financial News API (real-time institutional wire)
            </span>
          </div>
        </div>
      </div>

      {/* "WHY IS IT MOVING?" Perplexity-Style AI Summary Section */}
      <div className="border-b border-zinc-800 bg-zinc-950/70 p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
            <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
            <span>WHY IS IT MOVING? // AI SEARCH-GROUNDED BRIEFING</span>
          </div>
          <button
            onClick={() => onRefreshSummary(tickerData.symbol)}
            disabled={isSummaryLoading}
            className="text-[11px] text-zinc-400 hover:text-emerald-400 flex items-center gap-1 transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isSummaryLoading ? "animate-spin" : ""}`} />
            <span>{isSummaryLoading ? "ANALYZING..." : "REGENERATE"}</span>
          </button>
        </div>

        {isSummaryLoading ? (
          <div className="p-6 bg-zinc-900/40 border border-zinc-800/80 rounded flex items-center justify-center gap-3 text-xs text-zinc-400">
            <Sparkles className="w-4 h-4 text-emerald-400 animate-spin" />
            <span>Consulting Google Search grounding & Gemini Flash catalyst model...</span>
          </div>
        ) : tickerData.summary ? (
          <div className="bg-zinc-900/40 border border-zinc-800/80 p-3.5 rounded flex flex-col gap-3">
            {/* The 4-6 sentences summary text */}
            <p className="text-xs leading-relaxed text-zinc-200 font-sans tracking-wide">
              {tickerData.summary.summary}
            </p>

            {/* Numbered Citations (Perplexity style) */}
            {tickerData.summary.citations && tickerData.summary.citations.length > 0 && (
              <div className="pt-2 border-t border-zinc-800/60 flex flex-col gap-1.5">
                <span className="text-[10px] text-zinc-500 uppercase font-bold tracking-wider">
                  VERIFIED GROUNDING SOURCES ({tickerData.summary.citations.length}):
                </span>
                <div className="flex flex-wrap gap-2">
                  {tickerData.summary.citations.map((cite) => (
                    <a
                      key={cite.index}
                      href={cite.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700/80 hover:border-emerald-500/60 px-2 py-1 rounded text-[11px] text-zinc-300 hover:text-emerald-300 transition-colors group"
                      title={cite.title}
                    >
                      <span className="w-3.5 h-3.5 rounded-full bg-zinc-800 flex items-center justify-center text-[9px] font-bold text-emerald-400 group-hover:bg-emerald-950">
                        {cite.index}
                      </span>
                      <Globe className="w-2.5 h-2.5 text-zinc-500 group-hover:text-emerald-400" />
                      <span className="max-w-[180px] truncate text-[10px]">{cite.source}</span>
                      <ExternalLink className="w-2.5 h-2.5 text-zinc-500 group-hover:text-emerald-400" />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="p-4 bg-zinc-900/30 border border-zinc-800/60 rounded flex items-center justify-between text-xs text-zinc-400">
            <span>No catalyst briefing generated yet for {tickerData.symbol}.</span>
            <button
              onClick={() => onRefreshSummary(tickerData.symbol)}
              className="bg-emerald-600 hover:bg-emerald-500 text-black px-2.5 py-1 rounded text-xs font-bold"
            >
              GENERATE BRIEFING
            </button>
          </div>
        )}
      </div>

      {/* ARTICLE FEED SECTION */}
      <div className="flex-1 flex flex-col p-4">
        {/* Feed Header with Filter Tabs and Search */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-zinc-300">
              ARTICLE FEED ({displayedArticles.length})
            </span>

            {/* Sentiment Filter Tabs */}
            <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5 text-[10px]">
              {(["ALL", "bullish", "neutral", "bearish"] as const).map((tab) => {
                const count =
                  tab === "ALL"
                    ? windowArticles.length
                    : tab === "bullish"
                    ? bullishCount
                    : tab === "neutral"
                    ? neutralCount
                    : bearishCount;

                return (
                  <button
                    key={tab}
                    onClick={() => setSentimentFilter(tab)}
                    className={`px-2 py-0.5 rounded uppercase font-semibold transition-colors ${
                      sentimentFilter === tab
                        ? "bg-zinc-700 text-white shadow"
                        : "text-zinc-400 hover:text-zinc-200"
                    }`}
                  >
                    {tab} ({count})
                  </button>
                );
              })}
            </div>
          </div>

          {/* Quick search input within articles */}
          <div className="relative w-48 sm:w-64">
            <Search className="w-3 h-3 text-zinc-500 absolute left-2 top-2" />
            <input
              type="text"
              value={articleSearch}
              onChange={(e) => setArticleSearch(e.target.value)}
              placeholder="Search headlines or rationale..."
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-zinc-700 focus:outline-none text-zinc-200 text-xs pl-7 pr-2 py-1 rounded placeholder:text-zinc-600"
            />
          </div>
        </div>

        {/* Dense Terminal Article Table */}
        <div className="border border-zinc-800 rounded overflow-hidden divide-y divide-zinc-900 bg-zinc-950">
          {displayedArticles.length === 0 ? (
            <div className="p-8 text-center text-xs text-zinc-500 font-mono">
              <span>NO ARTICLES FOUND MATCHING CURRENT WINDOW OR FILTER</span>
            </div>
          ) : (
            displayedArticles.map((art) => {
              const artRating = art.label ? art.label.toUpperCase() : "UNSCORED";
              const artColor = art.label ? getRatingColor(art.label) : {
                text: "text-zinc-400",
                bg: "bg-zinc-900",
                border: "border-zinc-700",
                accent: "#71717a",
              };

              let formattedDate = "";
              try {
                const d = new Date(art.publishedTime);
                formattedDate = `${d.toLocaleDateString(undefined, {
                  month: "short",
                  day: "numeric",
                })} ${d.toLocaleTimeString(undefined, {
                  hour: "2-digit",
                  minute: "2-digit",
                  hour12: false,
                })}`;
              } catch {
                formattedDate = art.publishedTime;
              }

              return (
                <div
                  key={art.id}
                  className="p-3 hover:bg-zinc-900/50 transition-colors flex flex-col gap-1.5 group"
                >
                  {/* Meta Bar: Time, Source, Rating Badge, Score, Relevance */}
                  <div className="flex items-center justify-between text-[11px] gap-2">
                    <div className="flex items-center gap-2">
                      <span className="text-zinc-500 flex items-center gap-1 font-mono text-[10px]">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formattedDate}</span>
                      </span>
                      <span className="text-zinc-400 font-bold bg-zinc-900 px-1.5 py-0.5 rounded border border-zinc-800 text-[10px]">
                        {art.source}
                      </span>
                    </div>

                    <div className="flex items-center gap-2">
                      {typeof art.relevance === "number" && (
                        <span className="text-[10px] text-zinc-500 font-mono">
                          {Math.round(art.relevance * 100)}% REL
                        </span>
                      )}
                      <span
                        className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${artColor.text} ${artColor.bg} ${artColor.border}`}
                      >
                        {artRating}
                      </span>
                      {typeof art.score === "number" && (
                        <span className={`text-[11px] font-bold font-mono tabular-nums ${artColor.text}`}>
                          {art.score > 0 ? `+${art.score.toFixed(2)}` : art.score.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Headline Link */}
                  <a
                    href={art.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-semibold text-zinc-100 hover:text-emerald-400 transition-colors flex items-start gap-1 font-sans group-hover:underline"
                  >
                    <span>{art.title}</span>
                    <ExternalLink className="w-3 h-3 text-zinc-600 group-hover:text-emerald-400 shrink-0 mt-0.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                  </a>

                  {/* One-line Investor Rationale */}
                  {art.rationale && (
                    <div className="text-[11px] text-zinc-400 bg-zinc-900/70 border-l-2 border-zinc-700 pl-2 py-0.5 font-sans">
                      <span className="text-zinc-500 font-mono text-[9px] uppercase tracking-wider mr-1">
                        RATIONALE:
                      </span>
                      <span>{art.rationale}</span>
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
