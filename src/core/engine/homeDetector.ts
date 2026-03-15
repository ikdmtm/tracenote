import type { SQLiteDatabase } from "expo-sqlite";

import { getSetting, setSetting } from "@/core/storage/settingsRepo";

const CLUSTER_RADIUS_M = 200;
const MIN_NIGHTS = 3;

export type HomeLocation = {
  lat: number;
  lng: number;
  count: number;
};

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Detect home location from night stays (0:00-6:00, 3h+ duration).
 * Clusters nearby stays and picks the most frequent cluster.
 */
export async function detectHomeLocation(db: SQLiteDatabase): Promise<HomeLocation | null> {
  const rows = await db.getAllAsync<{ lat: number; lng: number }>(
    `SELECT lat, lng FROM stays
     WHERE (start_ts % 86400000) / 3600000 < 6
       AND (end_ts - start_ts) >= 10800000
     ORDER BY start_ts DESC
     LIMIT 200`,
  );

  if (rows.length < MIN_NIGHTS) return null;

  type Cluster = { lat: number; lng: number; count: number };
  const clusters: Cluster[] = [];

  for (const row of rows) {
    let merged = false;
    for (const c of clusters) {
      if (haversineM(c.lat, c.lng, row.lat, row.lng) <= CLUSTER_RADIUS_M) {
        c.lat = (c.lat * c.count + row.lat) / (c.count + 1);
        c.lng = (c.lng * c.count + row.lng) / (c.count + 1);
        c.count++;
        merged = true;
        break;
      }
    }
    if (!merged) {
      clusters.push({ lat: row.lat, lng: row.lng, count: 1 });
    }
  }

  clusters.sort((a, b) => b.count - a.count);
  const top = clusters[0];
  if (!top || top.count < MIN_NIGHTS) return null;

  return top;
}

export async function getHomeLocation(db: SQLiteDatabase): Promise<HomeLocation | null> {
  const raw = await getSetting(db, "home_location");
  if (raw) {
    try {
      return JSON.parse(raw) as HomeLocation;
    } catch {}
  }
  return null;
}

export async function refreshHomeLocation(db: SQLiteDatabase): Promise<HomeLocation | null> {
  const home = await detectHomeLocation(db);
  if (home) {
    await setSetting(db, "home_location", JSON.stringify(home));
  }
  return home;
}

export function isHomeStay(stay: { lat: number; lng: number }, home: HomeLocation | null): boolean {
  if (!home) return false;
  return haversineM(stay.lat, stay.lng, home.lat, home.lng) <= CLUSTER_RADIUS_M;
}
