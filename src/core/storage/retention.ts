import type { SQLiteDatabase } from "expo-sqlite";

const RAW_EVENT_RETENTION_DAYS = 30;

/**
 * Delete raw events older than the retention period.
 * Stays are kept permanently as they are the processed/user-edited result.
 */
export async function pruneOldRawEvents(db: SQLiteDatabase): Promise<number> {
  const cutoff = Date.now() - RAW_EVENT_RETENTION_DAYS * 24 * 60 * 60_000;

  const result = await db.runAsync(
    "DELETE FROM raw_events WHERE ts < ?",
    [cutoff],
  );
  return result.changes;
}
