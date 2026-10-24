import { GoogleGenAI } from "@google/genai";

export const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in server environment.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
};

/**
 * Execute a Gemini API call with exponential backoff for 429 / rate limits.
 */
export async function callWithRetry<T>(
  fn: () => Promise<T>,
  retries = 3,
  delayMs = 1500
): Promise<T> {
  let attempt = 0;
  while (attempt < retries) {
    try {
      return await fn();
    } catch (err: any) {
      attempt++;
      const errorMessage = err?.message || String(err);
      const isRateLimit =
        errorMessage.includes("429") ||
        errorMessage.includes("RESOURCE_EXHAUSTED") ||
        errorMessage.includes("Quota exceeded");

      if (attempt >= retries || (!isRateLimit && !errorMessage.includes("503"))) {
        throw err;
      }

      const backoff = delayMs * Math.pow(2, attempt - 1) + Math.random() * 500;
      console.warn(`[Gemini API] Rate limit / transient error on attempt ${attempt}. Retrying in ${Math.round(backoff)}ms...`);
      await new Promise((res) => setTimeout(res, backoff));
    }
  }
  throw new Error("Maximum retries exceeded");
}
