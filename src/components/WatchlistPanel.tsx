import React, { useState, useMemo } from "react";
import {
  ArrowUpDown,
  Calendar,
  ChevronDown,
  ChevronUp,
  Plus,
  RefreshCw,
  Search,
  X,
  Zap,
} from "lucide-react";
import { RatingBadge, TickerData } from "../types/terminal";
import { getRatingColor } from "../utils/scoring";

interface WatchlistPanelProps {
  watchlist: TickerData[];
  selectedTicker: string;
  onSelectTicker: (symbol: string) => void;
  onAddTicker: (symbol: string) => void;
  onRemoveTicker: (symbol: string) => void;
  onRefreshTicker: (symbol: string) => void;
  isProcessing: boolean;
}

type SortField = "symbol" | "rating" | "score" | "articleCount" | "nextEarnings";
type SortDirection = "asc" | "desc";

export const WatchlistPanel: React.FC<WatchlistPanelProps> = ({
  watchlist,
  selectedTicker,
  onSelectTicker,
  onAddTicker,
  onRemoveTicker,
  onRefreshTicker,
  isProcessing,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [newTickerInput, setNewTickerInput] = useState("");
  const [sortField, setSortField] = useState<SortField>("score");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const handleAddSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newTickerInput.trim().toUpperCase();
    if (!clean) return;
    onAddTicker(clean);
    setNewTickerInput("");
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection(field === "score" || field === "articleCount" ? "desc" : "asc");
    }
  };

  const filteredAndSortedWatchlist = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    const filtered = watchlist.filter((item) => {
      if (!q) return true;
      return (
        item.symbol.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.rating.toLowerCase().includes(q)
      );
    });

    return filtered.sort((a, b) => {
      let comparison = 0;
      if (sortField === "symbol") {
        comparison = a.symbol.localeCompare(b.symbol);
      } else if (sortField === "score") {
        comparison = a.score - b.score;
      } else if (sortField === "articleCount") {
        comparison = a.articleCount - b.articleCount;
      } else if (sortField === "rating") {
        const order: Record<RatingBadge, number> = { BULLISH: 3, NEUTRAL: 2, BEARISH: 1 };
        comparison = (order[a.rating] || 0) - (order[b.rating] || 0);
      } else if (sortField === "nextEarnings") {
        const dateA = a.nextEarnings || "9999-99-99";
        const dateB = b.nextEarnings || "9999-99-99";
        comparison = dateA.localeCompare(dateB);
      }

      return sortDirection === "asc" ? comparison : -comparison;
    });
  }, [watchlist, searchQuery, sortField, sortDirection]);

  return (
    <div className="flex flex-col h-full bg-zinc-950 border-r border-zinc-800 w-full select-none">
      {/* Top Controls: Add Ticker & Search Filter */}
      <div className="p-2 border-b border-zinc-800 flex flex-col gap-2 bg-zinc-950/80">
        {/* Add Ticker Input */}
        <form onSubmit={handleAddSubmit} className="flex items-center gap-1.5">
          <div className="relative flex-1">
            <input
              type="text"
              value={newTickerInput}
              onChange={(e) => setNewTickerInput(e.target.value.toUpperCase())}
              placeholder="ADD TICKER (e.g. NVDA, ^GSPC, GLD)..."
              maxLength={12}
              className="w-full bg-zinc-900 border border-zinc-800 focus:border-emerald-500 focus:outline-none text-zinc-100 text-xs px-2.5 py-1.5 rounded uppercase placeholder:text-zinc-600 font-mono tracking-wider"
            />
          </div>
          <button
            type="submit"
            disabled={!newTickerInput.trim() || watchlist.length >= 100}
            className="bg-zinc-800 hover:bg-emerald-600 hover:text-black disabled:opacity-40 disabled:hover:bg-zinc-800 disabled:hover:text-zinc-400 text-zinc-200 text-xs font-bold px-2.5 py-1.5 rounded border border-zinc-700 transition-colors flex items-center gap-1"
          >
            <Plus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">ADD</span>
          </button>
        </form>

        {/* Filter and Count Row */}
        <div className="flex items-center justify-between gap-2">
          <div className="relative flex-1">
            <Search className="w-3.5 h-3.5 text-zinc-600 absolute left-2 top-2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter watchlist..."
              className="w-full bg-zinc-900/50 border border-zinc-800/80 focus:border-zinc-700 focus:outline-none text-zinc-300 text-xs pl-7 pr-2 py-1 rounded placeholder:text-zinc-600"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2 top-1.5 text-zinc-500 hover:text-zinc-300"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <div className="text-[10px] text-zinc-500 font-mono tracking-tight shrink-0">
            <span>{watchlist.length}/100 ASSETS</span>
          </div>
        </div>
      </div>

      {/* Table Header */}
      <div className="grid grid-cols-12 gap-1 px-3 py-1.5 bg-zinc-900/90 border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-400 tracking-wider">
        <div
          onClick={() => handleSort("symbol")}
          className="col-span-3 flex items-center gap-1 cursor-pointer hover:text-zinc-200 transition-colors"
        >
          <span>TICKER</span>
          {sortField === "symbol" ? (
            sortDirection === "asc" ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />
          ) : (
            <ArrowUpDown className="w-2.5 h-2.5 text-zinc-600" />
          )}
        </div>

        <div
          onClick={() => handleSort("rating")}
          className="col-span-3 flex items-center justify-center gap-1 cursor-pointer hover:text-zinc-200 transition-colors text-center"
        >
          <span>RATING</span>
          {sortField === "rating" ? (
            sortDirection === "asc" ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />
          ) : (
            <ArrowUpDown className="w-2.5 h-2.5 text-zinc-600" />
          )}
        </div>

        <div
          onClick={() => handleSort("score")}
          className="col-span-2 flex items-center justify-center gap-1 cursor-pointer hover:text-zinc-200 transition-colors text-center"
        >
          <span>SCORE</span>
          {sortField === "score" ? (
            sortDirection === "asc" ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />
          ) : (
            <ArrowUpDown className="w-2.5 h-2.5 text-zinc-600" />
          )}
        </div>

        <div
          onClick={() => handleSort("articleCount")}
          className="col-span-1 flex items-center justify-center cursor-pointer hover:text-zinc-200 transition-colors text-center"
          title="Number of Analyzed Articles"
        >
          <span>#</span>
        </div>

        <div
          onClick={() => handleSort("nextEarnings")}
          className="col-span-2 flex items-center justify-center gap-1 cursor-pointer hover:text-zinc-200 transition-colors text-center"
        >
          <span>EARNINGS</span>
          {sortField === "nextEarnings" ? (
            sortDirection === "asc" ? <ChevronUp className="w-3 h-3 text-emerald-400" /> : <ChevronDown className="w-3 h-3 text-emerald-400" />
          ) : (
            <ArrowUpDown className="w-2.5 h-2.5 text-zinc-600" />
          )}
        </div>

        <div className="col-span-1 text-right">
          <span>ACT</span>
        </div>
      </div>

      {/* Watchlist Rows (Scrollable) */}
      <div className="flex-1 overflow-y-auto divide-y divide-zinc-900">
        {filteredAndSortedWatchlist.length === 0 ? (
          <div className="p-8 text-center text-zinc-500 text-xs font-mono">
            <span>NO MATCHING TICKERS FOUND</span>
          </div>
        ) : (
          filteredAndSortedWatchlist.map((item) => {
            const isSelected = item.symbol === selectedTicker;
            const colors = getRatingColor(item.rating);
            const isWithin7Days =
              item.earningsDaysAway !== null &&
              item.earningsDaysAway >= 0 &&
              item.earningsDaysAway <= 7;

            // Mini bar percentage (-1 to +1 -> 0% to 100%)
            const barWidthPercent = Math.min(
              100,
              Math.max(0, ((item.score + 1) / 2) * 100)
            );

            return (
              <div
                key={item.symbol}
                onClick={() => onSelectTicker(item.symbol)}
                className={`grid grid-cols-12 gap-1 px-3 py-2 text-xs items-center cursor-pointer transition-colors group ${
                  isSelected
                    ? "bg-zinc-900 border-l-2 border-emerald-400 text-zinc-100"
                    : "hover:bg-zinc-900/60 text-zinc-300"
                }`}
              >
                {/* Symbol & Name */}
                <div className="col-span-3 flex flex-col min-w-0 pr-1">
                  <div className="flex items-center gap-1.5">
                    <span className="font-bold tracking-wider font-mono text-zinc-100 group-hover:text-emerald-400 transition-colors">
                      {item.symbol}
                    </span>
                    {item.status === "fetching" && (
                      <RefreshCw className="w-2.5 h-2.5 text-amber-400 animate-spin" />
                    )}
                    {item.status === "scoring" && (
                      <Zap className="w-2.5 h-2.5 text-emerald-400 animate-pulse" />
                    )}
                  </div>
                  <span className="text-[10px] text-zinc-500 truncate" title={item.name}>
                    {item.name}
                  </span>
                </div>

                {/* Rating Badge */}
                <div className="col-span-3 flex justify-center">
                  <span
                    className={`text-[10px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${colors.text} ${colors.bg} ${colors.border}`}
                  >
                    {item.rating}
                  </span>
                </div>

                {/* Score & Mini Bar */}
                <div className="col-span-2 flex flex-col items-center justify-center">
                  <span className={`text-[11px] font-bold tabular-nums ${colors.text}`}>
                    {item.score > 0 ? `+${item.score.toFixed(2)}` : item.score.toFixed(2)}
                  </span>
                  <div className="w-12 h-1 bg-zinc-800 rounded-sm relative overflow-hidden mt-0.5">
                    <div
                      className="absolute top-0 bottom-0 w-1 bg-white"
                      style={{ left: `${barWidthPercent}%` }}
                    />
                  </div>
                </div>

                {/* # Articles */}
                <div className="col-span-1 text-center text-[11px] font-mono tabular-nums text-zinc-400">
                  {item.articleCount}
                </div>

                {/* Next Earnings */}
                <div className="col-span-2 flex justify-center text-center">
                  {isWithin7Days ? (
                    <span
                      title={`Earnings in ${item.earningsDaysAway} days (${item.nextEarnings})`}
                      className="text-[9px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/50 px-1 py-0.5 rounded tracking-tighter animate-pulse flex items-center gap-0.5"
                    >
                      <Calendar className="w-2.5 h-2.5" />
                      <span>{item.earningsDaysAway === 0 ? "TODAY" : `${item.earningsDaysAway}D`}</span>
                    </span>
                  ) : item.nextEarnings ? (
                    <span
                      title={`Next earnings: ${item.nextEarnings}`}
                      className="text-[10px] text-zinc-400 font-mono"
                    >
                      {item.nextEarnings.slice(5)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-600 font-mono">—</span>
                  )}
                </div>

                {/* Actions: Refresh & Delete */}
                <div className="col-span-1 flex items-center justify-end gap-1">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRefreshTicker(item.symbol);
                    }}
                    title={`Refresh ${item.symbol}`}
                    className="p-1 text-zinc-500 hover:text-emerald-400 transition-colors"
                  >
                    <RefreshCw className="w-3 h-3" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onRemoveTicker(item.symbol);
                    }}
                    title={`Remove ${item.symbol}`}
                    className="p-1 text-zinc-600 hover:text-rose-400 transition-colors"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
