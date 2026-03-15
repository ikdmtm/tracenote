import { TOKEN } from "@/core/constants";

const GPT4O_MINI_CONTEXT = 128_000;

/**
 * Rough token estimate for text.
 * GPT-4o-mini tokenizer: ~1 token per 4 chars for English, ~1.5 tokens per char for Japanese.
 * We use a conservative ratio for mixed JP/EN content.
 */
export function estimateTokens(text: string): number {
  let jpChars = 0;
  let otherChars = 0;
  for (const ch of text) {
    if (ch.charCodeAt(0) > 0x3000) {
      jpChars++;
    } else {
      otherChars++;
    }
  }
  return Math.ceil(jpChars * 1.5 + otherChars / 4);
}

export type TokenBudget = {
  inputTokens: number;
  maxContext: number;
  reserve: number;
  safeThreshold: number;
  needsSplit: boolean;
  maxOutputTokens: number;
};

/**
 * Calculate token budget for a diary generation request.
 */
export function calculateBudget(systemPrompt: string, userInput: string): TokenBudget {
  const inputTokens = estimateTokens(systemPrompt) + estimateTokens(userInput);
  const maxContext = GPT4O_MINI_CONTEXT;
  const reserve = Math.max(TOKEN.RESERVE_MIN, Math.floor(maxContext * TOKEN.RESERVE_RATIO));
  const safeThreshold = Math.floor(maxContext * TOKEN.SAFE_THRESHOLD_RATIO);
  const needsSplit = inputTokens > safeThreshold;
  const maxOutputTokens = Math.max(1024, maxContext - inputTokens - reserve);

  return {
    inputTokens,
    maxContext,
    reserve,
    safeThreshold,
    needsSplit,
    maxOutputTokens,
  };
}
