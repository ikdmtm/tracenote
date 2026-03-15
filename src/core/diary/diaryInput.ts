import type { SQLiteDatabase } from "expo-sqlite";

import type { Stay } from "@/core/domain/models";
import { ACTIVITY_LABELS, type Activity } from "@/core/engine/activityInference";
import { getStaysByDay } from "@/core/storage/stayRepo";
import { getPhotoCountByStayId } from "@/core/storage/stayPhotoRepo";

function formatHHMM(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function resolvePlaceName(stay: Stay): string {
  if (stay.user_place_name) return stay.user_place_name;
  if (stay.place_json) {
    try {
      const parsed = JSON.parse(stay.place_json);
      if (parsed.top?.name) return parsed.top.name;
      if (parsed.top?.category && parsed.top.category !== "other") return parsed.top.category;
    } catch {}
  }
  return "unknown";
}

type StayLine = {
  line: string;
  startTs: number;
  endTs: number;
};

/**
 * Build a single line for a Stay in the LLM input format.
 * Example: [08:10-12:00] stay place=渋谷オフィス activity=仕事・作業 conf=0.70 review=0 photos=2
 */
async function buildStayLine(
  db: SQLiteDatabase,
  stay: Stay,
): Promise<StayLine> {
  const photoCount = await getPhotoCountByStayId(db, stay.id);
  const place = resolvePlaceName(stay);
  const activity = stay.activity
    ? (ACTIVITY_LABELS[stay.activity as Activity] ?? stay.activity)
    : "不明";

  const line = `[${formatHHMM(stay.start_ts)}-${formatHHMM(stay.end_ts)}] stay place=${place} activity=${activity} conf=${stay.confidence.toFixed(2)} review=${stay.needs_review ? 1 : 0} photos=${photoCount}`;

  return { line, startTs: stay.start_ts, endTs: stay.end_ts };
}

/**
 * Build move lines between consecutive stays.
 */
function buildMoveLine(prevEnd: number, nextStart: number): string | null {
  const gap = nextStart - prevEnd;
  if (gap < 5 * 60_000) return null; // less than 5 min gap = no meaningful move
  return `[${formatHHMM(prevEnd)}-${formatHHMM(nextStart)}] move`;
}

export type DiaryInputResult = {
  lines: string[];
  dayKey: string;
  stayCount: number;
};

/**
 * Build LLM input for a day.
 * Returns stay/move lines in chronological order.
 */
export async function buildDiaryInput(
  db: SQLiteDatabase,
  dayStartTs: number,
  dayEndTs: number,
): Promise<DiaryInputResult> {
  const stays = await getStaysByDay(db, dayStartTs, dayEndTs);
  if (stays.length === 0) {
    return { lines: [], dayKey: formatDayKey(dayStartTs), stayCount: 0 };
  }

  const stayLines: StayLine[] = [];
  for (const stay of stays) {
    stayLines.push(await buildStayLine(db, stay));
  }

  const lines: string[] = [];
  for (let i = 0; i < stayLines.length; i++) {
    if (i > 0) {
      const move = buildMoveLine(stayLines[i - 1].endTs, stayLines[i].startTs);
      if (move) lines.push(move);
    }
    lines.push(stayLines[i].line);
  }

  return {
    lines,
    dayKey: formatDayKey(dayStartTs),
    stayCount: stays.length,
  };
}

function formatDayKey(ts: number): string {
  const d = new Date(ts);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

/**
 * Split diary input lines into time-based chunks for large inputs.
 */
export function splitIntoChunks(lines: string[]): string[][] {
  if (lines.length <= 4) return [lines];

  const mid = Math.ceil(lines.length / 2);
  return [lines.slice(0, mid), lines.slice(mid)];
}
