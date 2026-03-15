import type { SQLiteDatabase } from "expo-sqlite";

import { getRawEventsByDay } from "@/core/storage/rawEventRepo";
import { getStaysByDay } from "@/core/storage/stayRepo";
import { getSetting } from "@/core/storage/settingsRepo";
import { upsertMovements } from "@/core/storage/movementRepo";
import { detectStays } from "@/core/engine/stayDetector";
import { enrichStays } from "@/core/engine/enrichService";
import { estimateMovements } from "@/core/engine/movementEstimator";
import { matchPhotosForStays } from "@/core/photos/photoMatcher";
import { syncStayPhotos } from "@/core/storage/stayPhotoRepo";

/**
 * Run stay detection for a given time range.
 * Deletes existing stays in the range and replaces with fresh detection.
 * Then enriches them with place info and activity inference.
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
      `INSERT INTO stays (start_ts, end_ts, lat, lng, radius_m, confidence, needs_review, memo)
       VALUES (?, ?, ?, ?, ?, ?, 0, NULL)`,
      [stay.start_ts, stay.end_ts, stay.lat, stay.lng, stay.radius_m, stay.confidence],
    );
  }

  const insertedStays = await getStaysByDay(db, startTs, endTs);
  await enrichStays(db, insertedStays);

  // Persist movement estimates (preserves user_mode overrides via upsert)
  const movements = estimateMovements(insertedStays);
  await upsertMovements(db, movements);

  try {
    const exclScreenshots = (await getSetting(db, "exclude_screenshots")) !== "false";
    const photoMatches = await matchPhotosForStays(insertedStays, { excludeScreenshots: exclScreenshots });
    for (const [stayId, photos] of photoMatches) {
      await syncStayPhotos(db, stayId, photos);
    }
  } catch (e) {
    console.warn("[StayService] Photo matching skipped:", e);
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
