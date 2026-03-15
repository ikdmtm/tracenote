import type { SQLiteDatabase } from "expo-sqlite";

import { getRawEventsByDay } from "@/core/storage/rawEventRepo";
import { upsertStays } from "@/core/storage/stayRepo";
import { detectStays } from "@/core/engine/stayDetector";

/**
 * Run stay detection for a given time range.
 * Fetches raw events, runs the detector, and upserts results to DB.
 */
export async function runStayDetection(
  db: SQLiteDatabase,
  startTs: number,
  endTs: number,
): Promise<number> {
  const events = await getRawEventsByDay(db, startTs, endTs);
  if (events.length < 2) return 0;

  const detected = detectStays(events);
  if (detected.length === 0) return 0;

  await upsertStays(db, detected);
  return detected.length;
}

/** Run stay detection for today (from midnight to now). */
export async function runTodayStayDetection(
  db: SQLiteDatabase,
): Promise<number> {
  const now = Date.now();
  const startOfDay = new Date().setHours(0, 0, 0, 0);
  return runStayDetection(db, startOfDay, now + 1);
}
