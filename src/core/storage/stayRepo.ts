import type { SQLiteDatabase } from "expo-sqlite";

import type { Stay } from "@/core/domain/models";

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

export async function getStayById(
  db: SQLiteDatabase,
  id: number,
): Promise<Stay | null> {
  type StayRow = Omit<Stay, "needs_review"> & { needs_review: number };
  const row = await db.getFirstAsync<StayRow>(
    "SELECT * FROM stays WHERE id = ?",
    [id],
  );
  if (!row) return null;
  return { ...row, needs_review: Boolean(row.needs_review) };
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
