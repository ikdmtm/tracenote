import type { SQLiteDatabase } from "expo-sqlite";

import { DIARY } from "@/core/constants";
import { MIGRATIONS } from "@/core/storage/schema";
import { pruneOldRawEvents } from "@/core/storage/retention";

export const DB_NAME = "tracenote.db";

export async function initDatabase(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("PRAGMA journal_mode = WAL");
  await db.execAsync("PRAGMA foreign_keys = ON");

  for (const sql of MIGRATIONS) {
    await db.execAsync(sql);
  }

  await seedDefaults(db);

  pruneOldRawEvents(db).then((n) => {
    if (n > 0) console.log(`[Retention] Pruned ${n} old raw events`);
  }).catch(() => {});
}

async function seedDefaults(db: SQLiteDatabase): Promise<void> {
  const defaults: Record<string, string> = {
    day_end_time: DIARY.DEFAULT_DAY_END_TIME,
    generation_time: DIARY.DEFAULT_GENERATION_TIME,
  };

  for (const [key, value] of Object.entries(defaults)) {
    await db.runAsync(
      "INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)",
      [key, value],
    );
  }
}
