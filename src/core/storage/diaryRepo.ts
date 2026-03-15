import type { SQLiteDatabase } from "expo-sqlite";

import type { DiaryEntry } from "@/core/domain/models";

export async function getDiaryByDay(
  db: SQLiteDatabase,
  dayKey: string,
): Promise<DiaryEntry | null> {
  return db.getFirstAsync<DiaryEntry>(
    "SELECT * FROM diary_entries WHERE day_key = ?",
    [dayKey],
  );
}

export async function upsertDiary(
  db: SQLiteDatabase,
  entry: Omit<DiaryEntry, "id">,
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO diary_entries (day_key, title, body, highlights_json, share_text)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(day_key) DO UPDATE SET
       title = excluded.title,
       body = excluded.body,
       highlights_json = excluded.highlights_json,
       share_text = excluded.share_text`,
    [
      entry.day_key,
      entry.title,
      entry.body,
      entry.highlights_json,
      entry.share_text,
    ],
  );
  return result.lastInsertRowId;
}

export async function getRecentDiaries(
  db: SQLiteDatabase,
  limit = 30,
): Promise<DiaryEntry[]> {
  return db.getAllAsync<DiaryEntry>(
    "SELECT * FROM diary_entries ORDER BY day_key DESC LIMIT ?",
    [limit],
  );
}

export async function deleteDiary(
  db: SQLiteDatabase,
  dayKey: string,
): Promise<void> {
  await db.runAsync("DELETE FROM diary_entries WHERE day_key = ?", [dayKey]);
}
