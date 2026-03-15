import type { SQLiteDatabase } from "expo-sqlite";

import { fetchNearbyPlaces, type PlaceResult } from "@/core/places/overpass";

/**
 * Round coordinates to ~50m grid for cache key.
 * 0.0005° ≈ 55m lat, 45m lng at Tokyo latitude.
 */
function cacheKey(lat: number, lng: number): string {
  const rLat = (Math.round(lat / 0.0005) * 0.0005).toFixed(4);
  const rLng = (Math.round(lng / 0.0005) * 0.0005).toFixed(4);
  return `${rLat},${rLng}`;
}

/**
 * Get places for a coordinate, using settings table as cache.
 * Returns cached result if available, otherwise fetches from Overpass.
 */
export async function getPlacesWithCache(
  db: SQLiteDatabase,
  lat: number,
  lng: number,
): Promise<PlaceResult[]> {
  const key = `place_cache:${cacheKey(lat, lng)}`;

  const cached = await db.getFirstAsync<{ value: string }>(
    "SELECT value FROM settings WHERE key = ?",
    [key],
  );

  if (cached) {
    try {
      return JSON.parse(cached.value) as PlaceResult[];
    } catch {
      // corrupt cache, refetch
    }
  }

  try {
    const results = await fetchNearbyPlaces(lat, lng);
    await db.runAsync(
      "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
      [key, JSON.stringify(results)],
    );
    return results;
  } catch (e) {
    console.warn("[Places] Fetch failed, returning empty:", e);
    return [];
  }
}
