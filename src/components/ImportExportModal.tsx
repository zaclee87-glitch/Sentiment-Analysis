import React, { useState } from "react";
import { Check, Copy, Download, FileText, Upload, X } from "lucide-react";
import { TickerData } from "../types/terminal";
import { exportWatchlistToJson, parseImportedJson } from "../utils/storage";

interface ImportExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  watchlist: TickerData[];
  onImportWatchlist: (newList: TickerData[]) => void;
}

export const ImportExportModal: React.FC<ImportExportModalProps> = ({
  isOpen,
  onClose,
  watchlist,
  onImportWatchlist,
}) => {
  const [activeTab, setActiveTab] = useState<"export" | "import">("export");
  const [importText, setImportText] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const exportJsonString = JSON.stringify(
    {
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
    },
    null,
    2
  );

  const handleCopy = () => {
    navigator.clipboard.writeText(exportJsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      setImportText(text);
      setErrorMsg(null);
    };
    reader.readAsText(file);
  };

  const handleProcessImport = () => {
    if (!importText.trim()) {
      setErrorMsg("Please paste JSON text or select a valid file.");
      return;
    }

    const parsed = parseImportedJson(importText);
    if (!parsed) {
      setErrorMsg("Failed to parse valid watchlist array from JSON. Check syntax.");
      return;
    }

    onImportWatchlist(parsed);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-xs p-4 select-none font-mono">
      <div className="w-full max-w-xl bg-zinc-950 border border-zinc-800 rounded shadow-2xl flex flex-col overflow-hidden max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/80">
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4 text-emerald-400" />
            <h2 className="text-xs font-bold uppercase tracking-widest text-zinc-100">
              WATCHLIST DATA MANAGEMENT (JSON)
            </h2>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-zinc-200">
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab Selector */}
        <div className="flex border-b border-zinc-800 bg-zinc-900/40 text-xs">
          <button
            onClick={() => {
              setActiveTab("export");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-center font-bold uppercase tracking-wider transition-colors border-r border-zinc-800 ${
              activeTab === "export"
                ? "bg-zinc-900 text-emerald-400 border-b-2 border-b-emerald-400"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            EXPORT CURRENT ({watchlist.length} TICKERS)
          </button>
          <button
            onClick={() => {
              setActiveTab("import");
              setErrorMsg(null);
            }}
            className={`flex-1 py-2 text-center font-bold uppercase tracking-wider transition-colors ${
              activeTab === "import"
                ? "bg-zinc-900 text-emerald-400 border-b-2 border-b-emerald-400"
                : "text-zinc-400 hover:text-zinc-200"
            }`}
          >
            IMPORT / RESTORE
          </button>
        </div>

        {/* Tab Body */}
        <div className="p-4 overflow-y-auto flex flex-col gap-3 text-xs">
          {activeTab === "export" ? (
            <>
              <p className="text-zinc-400">
                Export your current watchlist configuration, ratings, and tracked symbols to JSON.
              </p>
              <textarea
                readOnly
                value={exportJsonString}
                className="w-full h-56 bg-black border border-zinc-800 p-2.5 rounded font-mono text-[11px] text-zinc-300 focus:outline-none resize-none"
              />
              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={handleCopy}
                  className="flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 px-3 py-1.5 rounded transition-colors"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? "COPIED TO CLIPBOARD" : "COPY JSON"}</span>
                </button>
                <button
                  onClick={() => exportWatchlistToJson(watchlist)}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-bold px-3 py-1.5 rounded transition-colors"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>DOWNLOAD .JSON FILE</span>
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="text-zinc-400">
                Paste a watchlist JSON string below or upload a .json file. (Maximum 100 tickers allowed).
              </p>

              <div className="flex items-center gap-3">
                <label className="cursor-pointer flex items-center gap-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-700 text-zinc-200 px-3 py-1.5 rounded transition-colors text-xs">
                  <Upload className="w-3.5 h-3.5 text-zinc-400" />
                  <span>SELECT FILE (.JSON)</span>
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={handleFileUpload}
                    className="hidden"
                  />
                </label>
                <span className="text-[10px] text-zinc-500">or paste content directly below:</span>
              </div>

              <textarea
                value={importText}
                onChange={(e) => {
                  setImportText(e.target.value);
                  setErrorMsg(null);
                }}
                placeholder='Paste JSON here, e.g. {"tickers": [{"symbol": "NVDA"}, {"symbol": "AAPL"}]}'
                className="w-full h-48 bg-black border border-zinc-800 p-2.5 rounded font-mono text-[11px] text-zinc-200 placeholder:text-zinc-700 focus:outline-none focus:border-emerald-500 resize-none"
              />

              {errorMsg && (
                <div className="text-rose-400 bg-rose-950/40 border border-rose-900/60 p-2 rounded text-[11px]">
                  {errorMsg}
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  onClick={onClose}
                  className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 text-zinc-300 rounded"
                >
                  CANCEL
                </button>
                <button
                  onClick={handleProcessImport}
                  className="flex items-center gap-1.5 bg-emerald-600 hover:bg-emerald-500 text-black font-bold px-4 py-1.5 rounded transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>APPLY WATCHLIST</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};
