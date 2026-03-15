import type { SQLiteDatabase } from "expo-sqlite";

import { getSetting } from "@/core/storage/settingsRepo";

type LLMRequest = {
  systemPrompt: string;
  userMessage: string;
  maxOutputTokens: number;
};

type LLMResponse = {
  content: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

const DEFAULT_PROXY_URL = "https://api.tracenote.app/v1/diary/generate";
const REQUEST_TIMEOUT_MS = 60_000;

/**
 * Call the diary generation API via server proxy.
 * The server handles OpenAI API key management.
 */
export async function callLLM(
  db: SQLiteDatabase,
  request: LLMRequest,
): Promise<LLMResponse> {
  const proxyUrl = (await getSetting(db, "proxy_url")) ?? DEFAULT_PROXY_URL;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(proxyUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: request.systemPrompt },
          { role: "user", content: request.userMessage },
        ],
        max_tokens: request.maxOutputTokens,
        temperature: 0.7,
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(`LLM API error ${res.status}: ${errorText}`);
    }

    const json = await res.json();

    // Support both OpenAI-compatible and custom proxy response formats
    const content =
      json.choices?.[0]?.message?.content ??
      json.content ??
      json.text ??
      "";

    return {
      content,
      usage: json.usage,
    };
  } finally {
    clearTimeout(timeout);
  }
}
