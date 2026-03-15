import type { SQLiteDatabase } from "expo-sqlite";

import type { DiaryEntry } from "@/core/domain/models";
import { buildDiaryInput, splitIntoChunks } from "@/core/diary/diaryInput";
import { callLLM } from "@/core/diary/llmClient";
import {
  DIARY_SYSTEM_PROMPT,
  CHUNK_SUMMARY_SYSTEM_PROMPT,
  buildUserMessage,
  buildChunkMessage,
  buildFinalMergeMessage,
} from "@/core/diary/prompts";
import { calculateBudget } from "@/core/diary/tokenEstimator";
import { getDiaryByDay, upsertDiary } from "@/core/storage/diaryRepo";

type DiaryResult = {
  title: string;
  body: string;
  highlights: string[];
  share_text: string;
};

function parseDiaryResponse(content: string): DiaryResult {
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("LLM response does not contain valid JSON");
  }

  const parsed = JSON.parse(jsonMatch[0]);
  return {
    title: parsed.title ?? "無題",
    body: parsed.body ?? "",
    highlights: Array.isArray(parsed.highlights) ? parsed.highlights : [],
    share_text: parsed.share_text ?? "",
  };
}

/**
 * Generate diary for a specific day.
 * Handles single-shot and split strategies based on token budget.
 */
export async function generateDiary(
  db: SQLiteDatabase,
  dayStartTs: number,
  dayEndTs: number,
): Promise<DiaryEntry | null> {
  const input = await buildDiaryInput(db, dayStartTs, dayEndTs);

  if (input.stayCount === 0) {
    return null;
  }

  const userMessage = buildUserMessage(input.dayKey, input.lines);
  const budget = calculateBudget(DIARY_SYSTEM_PROMPT, userMessage);

  let result: DiaryResult;

  if (!budget.needsSplit) {
    // Single-shot generation
    const response = await callLLM(db, {
      systemPrompt: DIARY_SYSTEM_PROMPT,
      userMessage,
      maxOutputTokens: Math.min(budget.maxOutputTokens, 4096),
    });
    result = parseDiaryResponse(response.content);
  } else {
    // Split strategy: chunk → summarize → merge → final diary
    const chunks = splitIntoChunks(input.lines);
    const summaries: string[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkLabel = i === 0 ? "前半" : "後半";
      const chunkMsg = buildChunkMessage(input.dayKey, chunkLabel, chunks[i]);
      const chunkBudget = calculateBudget(CHUNK_SUMMARY_SYSTEM_PROMPT, chunkMsg);

      const chunkResponse = await callLLM(db, {
        systemPrompt: CHUNK_SUMMARY_SYSTEM_PROMPT,
        userMessage: chunkMsg,
        maxOutputTokens: Math.min(chunkBudget.maxOutputTokens, 2048),
      });
      summaries.push(chunkResponse.content);
    }

    const mergeMessage = buildFinalMergeMessage(input.dayKey, summaries);
    const mergeBudget = calculateBudget(DIARY_SYSTEM_PROMPT, mergeMessage);

    const mergeResponse = await callLLM(db, {
      systemPrompt: DIARY_SYSTEM_PROMPT,
      userMessage: mergeMessage,
      maxOutputTokens: Math.min(mergeBudget.maxOutputTokens, 4096),
    });
    result = parseDiaryResponse(mergeResponse.content);
  }

  const entryData = {
    day_key: input.dayKey,
    title: result.title,
    body: result.body,
    highlights_json: JSON.stringify(result.highlights),
    share_text: result.share_text,
  };

  await upsertDiary(db, entryData);
  return getDiaryByDay(db, input.dayKey);
}

/**
 * Generate diary for today.
 */
export async function generateTodayDiary(
  db: SQLiteDatabase,
): Promise<DiaryEntry | null> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const endOfDay = startOfDay + 24 * 60 * 60_000;
  return generateDiary(db, startOfDay, endOfDay);
}

/**
 * Generate diary for yesterday.
 */
export async function generateYesterdayDiary(
  db: SQLiteDatabase,
): Promise<DiaryEntry | null> {
  const now = new Date();
  const startOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1).getTime();
  const endOfYesterday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return generateDiary(db, startOfYesterday, endOfYesterday);
}
