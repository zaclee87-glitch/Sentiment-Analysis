import React, { useEffect, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  Clock,
  Download,
  Info,
  Layers,
  RefreshCw,
  Upload,
} from "lucide-react";
import { MarketGaugeData, RatingBadge, TimeWindow } from "../types/terminal";
import { getRatingColor } from "../utils/scoring";

interface HeaderBarProps {
  marketGauge: MarketGaugeData | null;
  timeWindow: TimeWindow;
  setTimeWindow: (w: TimeWindow) => void;
  isRefreshingAll: boolean;
  refreshProgress: { current: number; total: number; ticker?: string } | null;
  onRefreshAll: () => void;
  onOpenImport: () => void;
  onExport: () => void;
  onOpenDrivers: () => void;
  rateLimitWarning: string | null;
}

export const HeaderBar: React.FC<HeaderBarProps> = ({
  marketGauge,
  timeWindow,
  setTimeWindow,
  isRefreshingAll,
  refreshProgress,
  onRefreshAll,
  onOpenImport,
  onExport,
  onOpenDrivers,
  rateLimitWarning,
}) => {
  const [utcTime, setUtcTime] = useState<string>("");

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setUtcTime(
        now.toISOString().replace("T", " ").replace(/\.\d+Z$/, " UTC")
      );
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  const gaugeScore = marketGauge?.score ?? 0;
  const gaugeLabel: RatingBadge = marketGauge?.label ?? "NEUTRAL";
  const colors = getRatingColor(gaugeLabel);

  // Gauge needle percent (from -1.0 to 1.0 -> 0% to 100%)
  const needlePercent = Math.min(100, Math.max(0, ((gaugeScore + 1) / 2) * 100));

  return (
    <header className="border-b border-zinc-800 bg-zinc-950 px-4 py-2 flex flex-col gap-2">
      {/* Rate limit warning banner if active */}
      {rateLimitWarning && (
        <div className="bg-amber-950/80 border border-amber-600/70 text-amber-200 px-3 py-1 text-xs flex items-center justify-between animate-pulse">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="font-semibold uppercase tracking-wider">Rate Limit Throttling:</span>
            <span>{rateLimitWarning}</span>
          </div>
          <span className="text-[10px] text-amber-400/80 uppercase">Retrying with exponential backoff</span>
        </div>
      )}

      <div className="flex items-center justify-between gap-4">
        {/* Terminal Brand & Live Clock */}
        <div className="flex items-center gap-4 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-ping opacity-75" />
            <div className="text-sm font-bold tracking-widest text-emerald-400 flex items-center gap-1.5 font-mono">
              <span>AURA</span>
              <span className="text-zinc-600">//</span>
              <span className="text-zinc-300">SENTIMENT TERMINAL</span>
            </div>
          </div>

          <div className="hidden lg:flex items-center gap-1.5 text-xs text-zinc-400 border-l border-zinc-800 pl-4">
            <Clock className="w-3.5 h-3.5 text-zinc-500" />
            <span className="tabular-nums tracking-wide">{utcTime}</span>
          </div>

          <div className="hidden xl:flex items-center gap-1.5 text-[11px] text-emerald-400/80 bg-emerald-950/40 border border-emerald-900/60 px-2 py-0.5 rounded">
            <Activity className="w-3 h-3 text-emerald-400" />
            <span className="uppercase tracking-wider">FEED: FINNHUB API + GEMINI FLASH</span>
          </div>
        </div>

        {/* Market Sentiment Gauge */}
        <div
          onClick={onOpenDrivers}
          title="Click to view Top Bullish & Bearish Market Drivers"
          className="flex items-center gap-3 bg-zinc-900/90 hover:bg-zinc-900 cursor-pointer border border-zinc-800 hover:border-zinc-700 px-3 py-1.5 rounded transition-all group"
        >
          <div className="flex flex-col">
            <div className="flex items-center justify-between text-[10px] text-zinc-400 uppercase tracking-wider font-semibold">
              <span className="flex items-center gap-1 group-hover:text-zinc-200">
                <span>MARKET GAUGE</span>
                <Info className="w-3 h-3 text-zinc-500 group-hover:text-amber-400 transition-colors" />
              </span>
              <span className="text-[9px] text-zinc-500 lowercase">(50% macro / 50% watchlist)</span>
            </div>

            <div className="flex items-center gap-2.5 mt-0.5">
              {/* Mini visual meter bar */}
              <div className="w-28 sm:w-36 h-2 bg-zinc-800 rounded-sm relative overflow-hidden flex">
                <div className="w-1/3 h-full bg-rose-950/80 border-r border-zinc-800" />
                <div className="w-1/3 h-full bg-amber-950/80 border-r border-zinc-800" />
                <div className="w-1/3 h-full bg-emerald-950/80" />
                {/* Needle */}
                <div
                  className="absolute top-0 bottom-0 w-1.5 bg-white shadow-lg transition-all duration-500 -ml-0.5"
                  style={{ left: `${needlePercent}%` }}
                />
              </div>

              {/* Gauge rating badge & score */}
              <div className="flex items-center gap-1.5">
                <span
                  className={`text-[11px] font-bold px-1.5 py-0.5 rounded border uppercase tracking-wider ${colors.text} ${colors.bg} ${colors.border}`}
                >
                  {gaugeLabel}
                </span>
                <span className={`text-xs font-bold tabular-nums ${colors.text}`}>
                  {gaugeScore > 0 ? `+${gaugeScore.toFixed(2)}` : gaugeScore.toFixed(2)}
                </span>
              </div>
            </div>
          </div>

          {/* Quick drivers peek icon */}
          <div className="hidden md:flex flex-col text-[10px] text-zinc-500 border-l border-zinc-800 pl-2">
            <span className="text-emerald-400 flex items-center">
              <ArrowUpRight className="w-3 h-3" />
              <span>{marketGauge?.bullishDrivers?.length || 0} Up</span>
            </span>
            <span className="text-rose-400 flex items-center">
              <ArrowDownRight className="w-3 h-3" />
              <span>{marketGauge?.bearishDrivers?.length || 0} Down</span>
            </span>
          </div>
        </div>

        {/* Right Action Controls: Window Toggle, Refresh All, Import/Export */}
        <div className="flex items-center gap-2 shrink-0">
          {/* Time Window Toggle (24H / 7D / 30D) */}
          <div className="flex items-center bg-zinc-900 border border-zinc-800 rounded p-0.5 text-xs font-semibold">
            {(["24H", "7D", "30D"] as TimeWindow[]).map((w) => (
              <button
                key={w}
                onClick={() => setTimeWindow(w)}
                className={`px-2 py-0.5 rounded transition-colors text-[11px] ${
                  timeWindow === w
                    ? "bg-zinc-700 text-zinc-100 shadow"
                    : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
                }`}
              >
                {w}
              </button>
            ))}
          </div>

          {/* Import / Export JSON Buttons */}
          <button
            onClick={onOpenImport}
            title="Import Watchlist JSON"
            className="flex items-center gap-1 text-xs text-zinc-300 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1 rounded transition-colors"
          >
            <Upload className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">IMPORT</span>
          </button>

          <button
            onClick={onExport}
            title="Export Watchlist JSON"
            className="flex items-center gap-1 text-xs text-zinc-300 hover:text-zinc-100 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 px-2.5 py-1 rounded transition-colors"
          >
            <Download className="w-3.5 h-3.5 text-zinc-400" />
            <span className="hidden sm:inline">EXPORT</span>
          </button>

          {/* Refresh All Button with sequential progress */}
          <button
            disabled={isRefreshingAll}
            onClick={onRefreshAll}
            className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded border transition-all ${
              isRefreshingAll
                ? "bg-emerald-950/40 border-emerald-700 text-emerald-400 cursor-wait"
                : "bg-emerald-600 hover:bg-emerald-500 text-black border-emerald-500 active:scale-95"
            }`}
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefreshingAll ? "animate-spin text-emerald-400" : "text-black"}`}
            />
            <span>
              {isRefreshingAll
                ? refreshProgress
                  ? `SCORING ${refreshProgress.current}/${refreshProgress.total}`
                  : "REFRESHING..."
                : "REFRESH ALL"}
            </span>
          </button>
        </div>
      </div>

      {/* Progress Bar when refreshing all */}
      {isRefreshingAll && refreshProgress && (
        <div className="w-full bg-zinc-900 h-1 rounded overflow-hidden">
          <div
            className="bg-emerald-400 h-full transition-all duration-300"
            style={{
              width: `${Math.round((refreshProgress.current / Math.max(1, refreshProgress.total)) * 100)}%`,
            }}
          />
        </div>
      )}
    </header>
  );
};
