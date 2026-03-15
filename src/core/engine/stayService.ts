import type { SQLiteDatabase } from "expo-sqlite";

import { getRawEventsByDay } from "@/core/storage/rawEventRepo";
import { detectStays } from "@/core/engine/stayDetector";

/**
 * Run stay detection for a given time range.
 * Deletes existing stays in the range and replaces with fresh detection.
 */
export async function runStayDetection(
  db: SQLiteDatabase,
  startTs: number,
  endTs: number,
): Promise<number> {
  const events = await getRawEventsByDay(db, startTs, endTs);
  if (events.length < 2) return 0;

  const detected = detectStays(events);

  await db.runAsync(
    "DELETE FROM stays WHERE start_ts >= ? AND start_ts < ?",
    [startTs, endTs],
  );

  if (detected.length === 0) return 0;

  for (const stay of detected) {
    await db.runAsync(
      `INSERT INTO stays (start_ts, end_ts, lat, lng, radius_m, confidence, needs_review)
       VALUES (?, ?, ?, ?, ?, ?, 0)`,
      [stay.start_ts, stay.end_ts, stay.lat, stay.lng, stay.radius_m, stay.confidence],
    );
  }

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
