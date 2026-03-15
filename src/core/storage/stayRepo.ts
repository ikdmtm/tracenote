import type { SQLiteDatabase } from "expo-sqlite";

import type { Stay } from "@/core/domain/models";
import type { DetectedStay } from "@/core/engine/stayDetector";

export async function insertStay(
  db: SQLiteDatabase,
  stay: DetectedStay,
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO stays (start_ts, end_ts, lat, lng, radius_m, confidence, needs_review)
     VALUES (?, ?, ?, ?, ?, ?, 0)`,
    [stay.start_ts, stay.end_ts, stay.lat, stay.lng, stay.radius_m, stay.confidence],
  );
  return result.lastInsertRowId;
}

export async function upsertStays(
  db: SQLiteDatabase,
  stays: DetectedStay[],
): Promise<void> {
  for (const stay of stays) {
    const existing = await db.getFirstAsync<{ id: number }>(
      `SELECT id FROM stays
       WHERE ABS(start_ts - ?) < 60000 AND ABS(end_ts - ?) < 60000`,
      [stay.start_ts, stay.end_ts],
    );

    if (existing) {
      await db.runAsync(
        `UPDATE stays SET lat = ?, lng = ?, radius_m = ?, confidence = ?, end_ts = ?
         WHERE id = ?`,
        [stay.lat, stay.lng, stay.radius_m, stay.confidence, stay.end_ts, existing.id],
      );
    } else {
      await insertStay(db, stay);
    }
  }
}

export async function getStaysByDay(
  db: SQLiteDatabase,
  dayStartTs: number,
  dayEndTs: number,
): Promise<Stay[]> {
  type StayRow = Omit<Stay, "needs_review"> & { needs_review: number };
  const rows = await db.getAllAsync<StayRow>(
    "SELECT * FROM stays WHERE start_ts >= ? AND start_ts < ? ORDER BY start_ts ASC",
    [dayStartTs, dayEndTs],
  );
  return rows.map((r) => ({ ...r, needs_review: Boolean(r.needs_review) }));
}

export async function getTodayStays(
  db: SQLiteDatabase,
): Promise<Stay[]> {
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  return getStaysByDay(db, startOfDay, Date.now() + 1);
}

export async function updateStay(
  db: SQLiteDatabase,
  id: number,
  fields: Partial<Pick<Stay, "activity" | "user_place_name" | "needs_review">>,
): Promise<void> {
  const sets: string[] = [];
  const values: (string | number | null)[] = [];

  if (fields.activity !== undefined) {
    sets.push("activity = ?");
    values.push(fields.activity);
  }
  if (fields.user_place_name !== undefined) {
    sets.push("user_place_name = ?");
    values.push(fields.user_place_name);
  }
  if (fields.needs_review !== undefined) {
    sets.push("needs_review = ?");
    values.push(fields.needs_review ? 1 : 0);
  }

  if (sets.length === 0) return;

  values.push(id);
  await db.runAsync(`UPDATE stays SET ${sets.join(", ")} WHERE id = ?`, values);
}
