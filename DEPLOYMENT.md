# Deployment Guide: AURA Financial News Sentiment Terminal

## Architecture
- **Frontend**: Vite + React 19 + TypeScript + Tailwind CSS (JetBrains Mono Bloomberg terminal design).
- **Backend / Serverless**:
  - Local/Preview: Express server (`server.ts`) hosting API routes and Vite dev middleware on port 3000.
  - Vercel: Vercel Serverless Functions (`/api/*.ts`) defined via `vercel.json`.
- **AI & Data Pipeline**:
  - Google Gemini 3.8 Flash for structured batch sentiment analysis and Google Search Grounded catalyst summaries.
  - Live financial RSS feeds (Yahoo Finance, Google News, CNBC, SEC EDGAR Atom).
  - Finnhub Earnings Calendar API (with Gemini Search Grounding fallback).

---

## 1. Environment Variables

Set the following environment variables in your Vercel project settings (or in `.env` locally):

| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | **Yes** | Google Gemini API key (server-side only, never exposed to client). |
| `FINNHUB_API_KEY` | *Optional* | Free-tier Finnhub API key for instant earnings calendar. If omitted, falls back to Gemini Search Grounding. |

---

## 2. Deploying to Vercel

### Option A: Using Vercel CLI
```bash
npm install -g vercel
vercel
# Follow prompts, set GEMINI_API_KEY when prompted or in Vercel dashboard
```

### Option B: Deploying via GitHub / Git
1. Push this repository to GitHub or GitLab.
2. In the [Vercel Dashboard](https://vercel.com/new), select "Import Repository".
3. Framework Preset: **Vite**
4. Root Directory: `./`
5. Build Command: `npm run build`
6. Output Directory: `dist`
7. Add Environment Variable:
   - `GEMINI_API_KEY`: `<your_gemini_api_key>`
   - `FINNHUB_API_KEY`: *(optional)*
8. Click **Deploy**.

---

## 3. Local Development

```bash
# 1. Install dependencies
npm install

# 2. Configure .env
cp .env.example .env
# Edit .env and insert your GEMINI_API_KEY

# 3. Start development server
npm run dev
# Terminal runs at http://localhost:3000
```
