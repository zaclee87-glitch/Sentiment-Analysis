export type SentimentLabel = 'bullish' | 'neutral' | 'bearish';
export type RatingBadge = 'BULLISH' | 'NEUTRAL' | 'BEARISH';
export type TimeWindow = '24H' | '7D' | '30D';

export interface Article {
  id: string;
  ticker?: string;
  title: string;
  source: string;
  url: string;
  publishedTime: string; // ISO string
  snippet: string;
  label?: SentimentLabel;
  score?: number; // -1.0 to 1.0
  rationale?: string;
  relevance?: number; // 0.0 to 1.0
}

export interface GroundingCitation {
  index: number;
  title: string;
  url: string;
  source: string;
}

export interface AISummary {
  ticker: string;
  summary: string;
  citations: GroundingCitation[];
  generatedAt: number;
}

export interface TickerData {
  symbol: string;
  name: string;
  type: 'stock' | 'etf' | 'index' | 'commodity';
  score: number; // -1.0 to +1.0
  rating: RatingBadge;
  articleCount: number;
  nextEarnings: string | null; // YYYY-MM-DD
  earningsDaysAway: number | null;
  earningsSource: string | null;
  lastRefreshed: number | null; // epoch ms
  status: 'idle' | 'fetching' | 'scoring' | 'done' | 'error';
  error: string | null;
  articles: Article[];
  summary?: AISummary | null;
}

export interface MarketDriver {
  title: string;
  source: string;
  score: number;
  ticker?: string;
  url?: string;
}

export interface MarketGaugeData {
  score: number; // -1.0 to +1.0
  label: RatingBadge;
  marketNewsScore: number;
  watchlistScore: number;
  bullishDrivers: MarketDriver[];
  bearishDrivers: MarketDriver[];
  lastRefreshed: number | null;
  marketArticles: Article[];
}
