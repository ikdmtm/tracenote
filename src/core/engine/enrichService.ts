import type { SQLiteDatabase } from "expo-sqlite";

import type { Stay } from "@/core/domain/models";
import { getPlacesWithCache } from "@/core/places/placeCache";
import { inferActivity } from "@/core/engine/activityInference";
import { updateStay } from "@/core/storage/stayRepo";

/**
 * Enrich a single Stay with place data and activity inference.
 * Fetches from Overpass (with cache), then runs rule-based inference.
 */
export async function enrichStay(
  db: SQLiteDatabase,
  stay: Stay,
): Promise<void> {
  const places = await getPlacesWithCache(db, stay.lat, stay.lng);

  const topPlace = places[0] ?? null;

  const durationMin = (stay.end_ts - stay.start_ts) / 60_000;
  const startHour = new Date(stay.start_ts).getHours();

  const result = inferActivity({
    category: topPlace?.category ?? null,
    startHour,
    durationMin,
    accuracy: stay.radius_m,
  });

  await updateStay(db, stay.id, {
    place_json: JSON.stringify({
      top: topPlace,
      count: places.length,
    }),
    activity: result.activity,
    confidence: result.confidence,
    needs_review: result.needs_review,
  });
}

/**
 * Enrich all stays in a list (e.g. today's newly detected stays).
 * Skips stays that already have place_json (unless force=true).
 */
export async function enrichStays(
  db: SQLiteDatabase,
  stays: Stay[],
  force = false,
): Promise<number> {
  let enriched = 0;
  for (const stay of stays) {
    if (!force && stay.place_json) continue;
    await enrichStay(db, stay);
    enriched++;
  }
  return enriched;
}
