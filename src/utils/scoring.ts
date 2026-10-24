import { Article, RatingBadge, SentimentLabel, TimeWindow } from "../types/terminal";

const HALF_LIFE_DAYS = 3;

/**
 * Filter articles by time window (24H, 7D, 30D).
 */
export function filterArticlesByWindow(articles: Article[], window: TimeWindow): Article[] {
  const now = Date.now();
  const windowMs =
    window === "24H"
      ? 24 * 60 * 60 * 1000
      : window === "7D"
      ? 7 * 24 * 60 * 60 * 1000
      : 30 * 24 * 60 * 60 * 1000;

  const filtered = articles.filter((a) => {
    const time = new Date(a.publishedTime).getTime();
    return now - time <= windowMs;
  });

  // If no articles in 24h, return articles within the closest window or all so UI doesn't look completely empty
  if (filtered.length === 0 && articles.length > 0) {
    return articles;
  }

  return filtered;
}

/**
 * Calculate recency-decayed, relevance-weighted composite score for an array of scored articles.
 * Half-life: 3 days.
 * Weight: relevance * 0.5^(ageInDays / 3)
 */
export function calculateDecayedScore(articles: Article[]): {
  score: number;
  rating: RatingBadge;
  scoredCount: number;
} {
  const scored = articles.filter((a) => typeof a.score === "number");
  if (scored.length === 0) {
    return { score: 0, rating: "NEUTRAL", scoredCount: 0 };
  }

  const now = Date.now();
  let totalWeightedScore = 0;
  let totalWeight = 0;

  for (const art of scored) {
    const pubTime = new Date(art.publishedTime).getTime();
    const ageDays = Math.max(0, (now - pubTime) / (1000 * 60 * 60 * 24));
    const decay = Math.pow(0.5, ageDays / HALF_LIFE_DAYS);
    const relevance = typeof art.relevance === "number" ? Math.max(0.1, art.relevance) : 0.8;
    const weight = relevance * decay;

    totalWeightedScore += (art.score as number) * weight;
    totalWeight += weight;
  }

  const compositeScore = totalWeight > 0 ? totalWeightedScore / totalWeight : 0;
  // Round to 2 decimal places
  const rounded = Math.round(compositeScore * 100) / 100;

  return {
    score: rounded,
    rating: getRatingBadge(rounded),
    scoredCount: scored.length,
  };
}

/**
 * Convert numeric score into rating badge.
 * Thresholds: >= +0.25 bullish, <= -0.25 bearish, else neutral.
 */
export function getRatingBadge(score: number): RatingBadge {
  if (score >= 0.25) return "BULLISH";
  if (score <= -0.25) return "BEARISH";
  return "NEUTRAL";
}

/**
 * Color classes for rating badges and indicators
 */
export function getRatingColor(rating: RatingBadge | SentimentLabel): {
  text: string;
  bg: string;
  border: string;
  accent: string;
} {
  const norm = rating.toUpperCase();
  if (norm === "BULLISH") {
    return {
      text: "text-emerald-400",
      bg: "bg-emerald-950/60",
      border: "border-emerald-600/70",
      accent: "#10b981",
    };
  }
  if (norm === "BEARISH") {
    return {
      text: "text-rose-400",
      bg: "bg-rose-950/60",
      border: "border-rose-600/70",
      accent: "#f43f5e",
    };
  }
  return {
    text: "text-amber-400",
    bg: "bg-amber-950/60",
    border: "border-amber-600/70",
    accent: "#f59e0b",
  };
}

/**
 * Calculate the Market Gauge by blending:
 * 50% market news score + 50% average of watchlist ticker scores.
 */
export function calculateMarketGauge(
  marketArticles: Article[],
  watchlistScores: number[]
): {
  score: number;
  label: RatingBadge;
  marketNewsScore: number;
  watchlistScore: number;
} {
  const marketCalc = calculateDecayedScore(marketArticles);
  const mScore = marketCalc.score;

  let wScore = 0;
  if (watchlistScores.length > 0) {
    const sum = watchlistScores.reduce((acc, curr) => acc + curr, 0);
    wScore = sum / watchlistScores.length;
  } else {
    wScore = mScore;
  }

  const blended = Math.round((0.5 * mScore + 0.5 * wScore) * 100) / 100;

  return {
    score: blended,
    label: getRatingBadge(blended),
    marketNewsScore: Math.round(mScore * 100) / 100,
    watchlistScore: Math.round(wScore * 100) / 100,
  };
}
