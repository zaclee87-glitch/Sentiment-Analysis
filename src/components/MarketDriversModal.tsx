import React from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ExternalLink,
  Layers,
  X,
} from "lucide-react";
import { MarketGaugeData } from "../types/terminal";
import { getRatingColor } from "../utils/scoring";

interface MarketDriversModalProps {
  isOpen: boolean;
  onClose: () => void;
  marketGauge: MarketGaugeData | null;
}

export const MarketDriversModal: React.FC<MarketDriversModalProps> = ({
  isOpen,
  onClose,
  marketGauge,
}) => {
  if (!isOpen) return null;

  const score = marketGauge?.score ?? 0;
  const label = marketGauge?.label ?? "NEUTRAL";
  const colors = getRatingColor(label);

  const bullishDrivers = marketGauge?.bullishDrivers || [];
  const bearishDrivers = marketGauge?.bearishDrivers || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none font-mono">
      <div className="w-full max-w-2xl bg-zinc-950 border border-zinc-800 rounded shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-100">
              MARKET SENTIMENT & PRIMARY CATALYSTS
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-zinc-500 hover:text-zinc-200 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 overflow-y-auto flex flex-col gap-4 text-xs">
          {/* Gauge Summary Banner */}
          <div className="bg-zinc-900/60 border border-zinc-800 p-3 rounded flex items-center justify-between">
            <div className="flex flex-col">
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">
                COMPOSITE BLENDED MARKET REGIME
              </span>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`text-xs font-bold px-2 py-0.5 rounded border uppercase tracking-wider ${colors.text} ${colors.bg} ${colors.border}`}
                >
                  {label}
                </span>
                <span className={`text-sm font-bold tabular-nums ${colors.text}`}>
                  {score > 0 ? `+${score.toFixed(2)}` : score.toFixed(2)}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4 text-[11px] text-zinc-400 border-l border-zinc-800 pl-4">
              <div>
                <span className="text-[9px] text-zinc-500 block uppercase">MACRO NEWS</span>
                <span className="font-bold tabular-nums">
                  {marketGauge?.marketNewsScore !== undefined
                    ? (marketGauge.marketNewsScore > 0 ? `+${marketGauge.marketNewsScore}` : marketGauge.marketNewsScore)
                    : "—"}
                </span>
              </div>
              <div>
                <span className="text-[9px] text-zinc-500 block uppercase">WATCHLIST AVG</span>
                <span className="font-bold tabular-nums">
                  {marketGauge?.watchlistScore !== undefined
                    ? (marketGauge.watchlistScore > 0 ? `+${marketGauge.watchlistScore}` : marketGauge.watchlistScore)
                    : "—"}
                </span>
              </div>
            </div>
          </div>

          {/* 3 Biggest Bullish Drivers */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-emerald-400 font-bold text-xs uppercase tracking-wider">
              <ArrowUpRight className="w-4 h-4" />
              <span>TOP 3 BULLISH MARKET DRIVERS</span>
            </div>

            <div className="divide-y divide-zinc-900 border border-emerald-950/60 bg-emerald-950/10 rounded overflow-hidden">
              {bullishDrivers.length === 0 ? (
                <div className="p-4 text-center text-zinc-500 text-xs">
                  No significant bullish catalysts scored in current window
                </div>
              ) : (
                bullishDrivers.map((d, i) => (
                  <div key={i} className="p-2.5 flex items-start justify-between gap-3 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-0.5">
                        {d.ticker && (
                          <span className="font-bold text-emerald-400 uppercase bg-zinc-900 px-1 py-0.2 rounded border border-zinc-800">
                            {d.ticker}
                          </span>
                        )}
                        <span>{d.source}</span>
                      </div>
                      {d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-200 hover:text-emerald-300 font-sans font-medium line-clamp-2 group-hover:underline flex items-center gap-1"
                        >
                          <span>{d.title}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                        </a>
                      ) : (
                        <p className="text-xs text-zinc-200 font-sans font-medium line-clamp-2">
                          {d.title}
                        </p>
                      )}
                    </div>
                    <span className="text-emerald-400 font-bold tabular-nums text-xs shrink-0">
                      +{d.score.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* 3 Biggest Bearish Drivers */}
          <div className="flex flex-col gap-2">
            <div className="flex items-center gap-1.5 text-rose-400 font-bold text-xs uppercase tracking-wider">
              <ArrowDownRight className="w-4 h-4" />
              <span>TOP 3 BEARISH MARKET DRIVERS</span>
            </div>

            <div className="divide-y divide-zinc-900 border border-rose-950/60 bg-rose-950/10 rounded overflow-hidden">
              {bearishDrivers.length === 0 ? (
                <div className="p-4 text-center text-zinc-500 text-xs">
                  No significant bearish catalysts scored in current window
                </div>
              ) : (
                bearishDrivers.map((d, i) => (
                  <div key={i} className="p-2.5 flex items-start justify-between gap-3 group">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 text-[10px] text-zinc-500 mb-0.5">
                        {d.ticker && (
                          <span className="font-bold text-rose-400 uppercase bg-zinc-900 px-1 py-0.2 rounded border border-zinc-800">
                            {d.ticker}
                          </span>
                        )}
                        <span>{d.source}</span>
                      </div>
                      {d.url ? (
                        <a
                          href={d.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-zinc-200 hover:text-rose-300 font-sans font-medium line-clamp-2 group-hover:underline flex items-center gap-1"
                        >
                          <span>{d.title}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0 opacity-70" />
                        </a>
                      ) : (
                        <p className="text-xs text-zinc-200 font-sans font-medium line-clamp-2">
                          {d.title}
                        </p>
                      )}
                    </div>
                    <span className="text-rose-400 font-bold tabular-nums text-xs shrink-0">
                      {d.score.toFixed(2)}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-4 py-2.5 border-t border-zinc-800 bg-zinc-900/60 flex justify-end">
          <button
            onClick={onClose}
            className="px-3 py-1 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-bold rounded transition-colors"
          >
            DISMISS [ESC]
          </button>
        </div>
      </div>
    </div>
  );
};
