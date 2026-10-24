import dotenv from "dotenv";
dotenv.config();

import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { createServer as createViteServer } from "vite";

import newsHandler from "./api/news.js";
import marketNewsHandler from "./api/market-news.js";
import earningsHandler from "./api/earnings.js";
import sentimentHandler from "./api/sentiment.js";
import summaryHandler from "./api/summary.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const PORT = parseInt(process.env.PORT || "3000", 10);

  // Body parser for JSON payloads
  app.use(express.json({ limit: "5mb" }));

  // API Routes
  app.all("/api/news", (req, res) => newsHandler(req, res));
  app.all("/api/market-news", (req, res) => marketNewsHandler(req, res));
  app.all("/api/earnings", (req, res) => earningsHandler(req, res));
  app.all("/api/sentiment", (req, res) => sentimentHandler(req, res));
  app.all("/api/summary", (req, res) => summaryHandler(req, res));

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      serverTime: new Date().toISOString(),
      geminiConfigured: !!process.env.GEMINI_API_KEY,
    });
  });

  const isProduction = process.env.NODE_ENV === "production";

  if (!isProduction) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, "dist")));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(__dirname, "dist", "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`[AURA Terminal] Server online at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("[AURA Terminal] Server startup failed:", err);
  process.exit(1);
});
