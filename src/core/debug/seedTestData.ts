import type { SQLiteDatabase } from "expo-sqlite";

import { runStayDetection } from "@/core/engine/stayService";

type FakeStay = {
  label: string;
  lat: number;
  lng: number;
  startHour: number;
  startMin: number;
  durationMin: number;
  jitterM?: number;
};

/**
 * Seed a full day of fake RawEvents simulating a realistic daily routine.
 * Locations are based on central Tokyo area.
 * After seeding, runs stay detection to generate Stays.
 */
export async function seedTestDay(
  db: SQLiteDatabase,
  dayOffset = 0,
): Promise<{ events: number; stays: number }> {
  const baseDate = new Date();
  baseDate.setDate(baseDate.getDate() - dayOffset);
  baseDate.setHours(0, 0, 0, 0);
  const dayStart = baseDate.getTime();
  const dayEnd = dayStart + 24 * 60 * 60_000;

  // Clear existing data for this day to avoid duplicates
  await db.runAsync("DELETE FROM stays WHERE start_ts >= ? AND start_ts < ?", [dayStart, dayEnd]);
  await db.runAsync("DELETE FROM raw_events WHERE ts >= ? AND ts < ?", [dayStart, dayEnd]);

  // Locations are 300m+ apart to ensure separate stay detection
  const scenario: FakeStay[] = [
    { label: "自宅", lat: 35.6812, lng: 139.7671, startHour: 0, startMin: 0, durationMin: 475, jitterM: 20 },
    { label: "オフィス", lat: 35.6586, lng: 139.7454, startHour: 8, startMin: 40, durationMin: 195, jitterM: 25 },
    { label: "レストラン", lat: 35.6550, lng: 139.7410, startHour: 12, startMin: 5, durationMin: 50, jitterM: 15 },
    { label: "オフィス", lat: 35.6586, lng: 139.7454, startHour: 13, startMin: 5, durationMin: 295, jitterM: 25 },
    { label: "ジム", lat: 35.6650, lng: 139.7550, startHour: 18, startMin: 30, durationMin: 75, jitterM: 20 },
    { label: "カフェ", lat: 35.6700, lng: 139.7620, startHour: 20, startMin: 0, durationMin: 40, jitterM: 15 },
    { label: "自宅", lat: 35.6812, lng: 139.7671, startHour: 21, startMin: 0, durationMin: 180, jitterM: 20 },
  ];

  let eventCount = 0;
  const intervalMs = 180_000; // 3 min

  for (const stay of scenario) {
    const startMs = dayStart + (stay.startHour * 60 + stay.startMin) * 60_000;
    const endMs = startMs + stay.durationMin * 60_000;
    const jitter = stay.jitterM ?? 30;

    for (let ts = startMs; ts < endMs; ts += intervalMs) {
      const latOff = (Math.random() - 0.5) * (jitter / 111_000);
      const lngOff = (Math.random() - 0.5) * (jitter / 91_000);
      const acc = 10 + Math.random() * 50;

      await db.runAsync(
        "INSERT INTO raw_events (ts, lat, lng, acc, source) VALUES (?, ?, ?, ?, ?)",
        [ts, stay.lat + latOff, stay.lng + lngOff, acc, "debug"],
      );
      eventCount++;
    }

    // movement events between stays (sparse, spread out)
    const nextIdx = scenario.indexOf(stay) + 1;
    if (nextIdx < scenario.length) {
      const next = scenario[nextIdx];
      const nextStartMs = dayStart + (next.startHour * 60 + next.startMin) * 60_000;
      const gap = nextStartMs - endMs;
      if (gap > 60_000) {
        const moveSteps = Math.min(3, Math.floor(gap / 60_000));
        for (let j = 1; j <= moveSteps; j++) {
          const frac = j / (moveSteps + 1);
          const moveLat = stay.lat + (next.lat - stay.lat) * frac + (Math.random() - 0.5) * 0.002;
          const moveLng = stay.lng + (next.lng - stay.lng) * frac + (Math.random() - 0.5) * 0.002;
          const moveTs = endMs + Math.floor(gap * frac);
          await db.runAsync(
            "INSERT INTO raw_events (ts, lat, lng, acc, source) VALUES (?, ?, ?, ?, ?)",
            [moveTs, moveLat, moveLng, 30 + Math.random() * 100, "debug"],
          );
          eventCount++;
        }
      }
    }
  }

  const stayCount = await runStayDetection(db, dayStart, dayEnd);

  return { events: eventCount, stays: stayCount };
}

/** Clear all debug/test data */
export async function clearAllData(db: SQLiteDatabase): Promise<void> {
  await db.execAsync("DELETE FROM stay_photos");
  await db.execAsync("DELETE FROM stays");
  await db.execAsync("DELETE FROM raw_events");
  await db.execAsync("DELETE FROM diary_entries");
}
