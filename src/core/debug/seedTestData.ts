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

  const scenario: FakeStay[] = [
    { label: "自宅（睡眠〜出発）", lat: 35.6812, lng: 139.7671, startHour: 0, startMin: 0, durationMin: 480 },
    { label: "通勤（電車）", lat: 35.6762, lng: 139.7503, startHour: 8, startMin: 10, durationMin: 5 },
    { label: "オフィス（午前）", lat: 35.6586, lng: 139.7454, startHour: 8, startMin: 40, durationMin: 200 },
    { label: "ランチ（レストラン）", lat: 35.6590, lng: 139.7440, startHour: 12, startMin: 0, durationMin: 55 },
    { label: "オフィス（午後）", lat: 35.6586, lng: 139.7454, startHour: 13, startMin: 0, durationMin: 300 },
    { label: "ジム", lat: 35.6610, lng: 139.7480, startHour: 18, startMin: 30, durationMin: 75 },
    { label: "カフェ", lat: 35.6620, lng: 139.7460, startHour: 19, startMin: 55, durationMin: 40 },
    { label: "自宅（帰宅後）", lat: 35.6812, lng: 139.7671, startHour: 21, startMin: 0, durationMin: 180 },
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

  const dayEnd = dayStart + 24 * 60 * 60_000;
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
