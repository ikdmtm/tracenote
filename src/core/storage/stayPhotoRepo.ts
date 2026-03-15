import * as MediaLibrary from "expo-media-library";
import type { SQLiteDatabase } from "expo-sqlite";

import type { StayPhoto } from "@/core/domain/models";

async function resolvePhUri(db: SQLiteDatabase, photo: StayPhoto): Promise<StayPhoto> {
  if (!photo.uri || !photo.uri.startsWith("ph://")) return photo;
  try {
    const info = await MediaLibrary.getAssetInfoAsync(photo.asset_id);
    if (info.localUri) {
      await db.runAsync("UPDATE stay_photos SET uri = ? WHERE id = ?", [info.localUri, photo.id]);
      return { ...photo, uri: info.localUri };
    }
  } catch {}
  return photo;
}

export async function getPhotosByStayId(
  db: SQLiteDatabase,
  stayId: number,
): Promise<StayPhoto[]> {
  const photos = await db.getAllAsync<StayPhoto>(
    "SELECT * FROM stay_photos WHERE stay_id = ? ORDER BY taken_at ASC",
    [stayId],
  );
  const resolved: StayPhoto[] = [];
  for (const p of photos) {
    resolved.push(await resolvePhUri(db, p));
  }
  return resolved;
}

export async function getPhotoCountByStayId(
  db: SQLiteDatabase,
  stayId: number,
): Promise<number> {
  const row = await db.getFirstAsync<{ cnt: number }>(
    "SELECT COUNT(*) as cnt FROM stay_photos WHERE stay_id = ?",
    [stayId],
  );
  return row?.cnt ?? 0;
}

export async function insertStayPhoto(
  db: SQLiteDatabase,
  photo: Omit<StayPhoto, "id">,
): Promise<number> {
  const result = await db.runAsync(
    `INSERT INTO stay_photos (stay_id, asset_id, uri, width, height, taken_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [photo.stay_id, photo.asset_id, photo.uri, photo.width, photo.height, photo.taken_at],
  );
  return result.lastInsertRowId;
}

export async function insertStayPhotos(
  db: SQLiteDatabase,
  photos: Omit<StayPhoto, "id">[],
): Promise<void> {
  for (const photo of photos) {
    await insertStayPhoto(db, photo);
  }
}

export async function deleteStayPhoto(
  db: SQLiteDatabase,
  photoId: number,
): Promise<void> {
  await db.runAsync("DELETE FROM stay_photos WHERE id = ?", [photoId]);
}

export async function deletePhotosByStayId(
  db: SQLiteDatabase,
  stayId: number,
): Promise<void> {
  await db.runAsync("DELETE FROM stay_photos WHERE stay_id = ?", [stayId]);
}

/**
 * Sync photos for a stay: delete existing, insert new matches.
 * Preserves manually added photos (those not in the new match set).
 */
export async function syncStayPhotos(
  db: SQLiteDatabase,
  stayId: number,
  newPhotos: Omit<StayPhoto, "id">[],
): Promise<void> {
  const existing = await getPhotosByStayId(db, stayId);
  const existingAssetIds = new Set(existing.map((p) => p.asset_id));
  const newAssetIds = new Set(newPhotos.map((p) => p.asset_id));

  // Remove auto-matched photos that are no longer matched
  for (const photo of existing) {
    if (!newAssetIds.has(photo.asset_id)) {
      await deleteStayPhoto(db, photo.id);
    }
  }

  // Add new photos that don't already exist
  for (const photo of newPhotos) {
    if (!existingAssetIds.has(photo.asset_id)) {
      await insertStayPhoto(db, photo);
    }
  }
}
