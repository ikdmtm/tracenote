import type { SQLiteDatabase } from "expo-sqlite";

import type { MovementRow } from "@/core/domain/models";

export async function getMovementsByDay(
  db: SQLiteDatabase,
  dayStartTs: number,
  dayEndTs: number,
): Promise<MovementRow[]> {
  return db.getAllAsync<MovementRow>(
    "SELECT * FROM movements WHERE start_ts >= ? AND start_ts < ? ORDER BY start_ts ASC",
    [dayStartTs, dayEndTs],
  );
}

export async function upsertMovements(
  db: SQLiteDatabase,
  movements: Omit<MovementRow, "id" | "user_mode">[],
): Promise<void> {
  for (const m of movements) {
    const existing = await db.getFirstAsync<{ id: number; user_mode: string | null }>(
      "SELECT id, user_mode FROM movements WHERE from_stay_id = ? AND to_stay_id = ?",
      [m.from_stay_id, m.to_stay_id],
    );

    if (existing) {
      await db.runAsync(
        `UPDATE movements SET start_ts = ?, end_ts = ?, distance_m = ?, duration_min = ?,
         avg_speed_kmh = ?, mode = ? WHERE id = ?`,
        [m.start_ts, m.end_ts, m.distance_m, m.duration_min, m.avg_speed_kmh, m.mode, existing.id],
      );
    } else {
      await db.runAsync(
        `INSERT INTO movements (from_stay_id, to_stay_id, start_ts, end_ts, distance_m, duration_min, avg_speed_kmh, mode)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [m.from_stay_id, m.to_stay_id, m.start_ts, m.end_ts, m.distance_m, m.duration_min, m.avg_speed_kmh, m.mode],
      );
    }
  }
}

export async function updateMovementUserMode(
  db: SQLiteDatabase,
  movementId: number,
  userMode: string | null,
): Promise<void> {
  await db.runAsync(
    "UPDATE movements SET user_mode = ? WHERE id = ?",
    [userMode, movementId],
  );
}

export async function deleteMovementsByDayRange(
  db: SQLiteDatabase,
  dayStartTs: number,
  dayEndTs: number,
): Promise<void> {
  await db.runAsync(
    "DELETE FROM movements WHERE start_ts >= ? AND start_ts < ?",
    [dayStartTs, dayEndTs],
  );
}
