import type { SQLiteDatabase } from "expo-sqlite";

import type { RawEvent } from "@/core/domain/models";

export async function insertRawEvent(
  db: SQLiteDatabase,
  event: Omit<RawEvent, "id">,
): Promise<void> {
  await db.runAsync(
    "INSERT INTO raw_events (ts, lat, lng, acc, source) VALUES (?, ?, ?, ?, ?)",
    [event.ts, event.lat, event.lng, event.acc, event.source],
  );
}

export async function getRawEventsByDay(
  db: SQLiteDatabase,
  dayStartTs: number,
  dayEndTs: number,
): Promise<RawEvent[]> {
  return db.getAllAsync<RawEvent>(
    "SELECT * FROM raw_events WHERE ts >= ? AND ts < ? ORDER BY ts ASC",
    [dayStartTs, dayEndTs],
  );
}

export async function getRawEventCount(
  db: SQLiteDatabase,
): Promise<number> {
  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM raw_events",
  );
  return row?.count ?? 0;
}

export async function getLatestRawEvents(
  db: SQLiteDatabase,
  limit: number,
): Promise<RawEvent[]> {
  return db.getAllAsync<RawEvent>(
    "SELECT * FROM raw_events ORDER BY ts DESC LIMIT ?",
    [limit],
  );
}
