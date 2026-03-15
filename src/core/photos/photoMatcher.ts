import * as MediaLibrary from "expo-media-library";

import type { Stay, StayPhoto } from "@/core/domain/models";

const TIME_MARGIN_MS = 5 * 60_000; // ±5 minutes
const GPS_RADIUS_M = 500;
const MAX_PHOTOS_PER_STAY = 10;

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

type MatchedPhoto = Omit<StayPhoto, "id">;

export type PhotoMatchOptions = {
  excludeScreenshots?: boolean;
};

/**
 * Find photos from camera roll that match a Stay's time window.
 * First filters by time, then checks GPS via getAssetInfoAsync for location scoring.
 */
export async function matchPhotosForStay(
  stay: Stay,
  options: PhotoMatchOptions = {},
): Promise<MatchedPhoto[]> {
  const fromTime = stay.start_ts - TIME_MARGIN_MS;
  const toTime = stay.end_ts + TIME_MARGIN_MS;

  const fromDate = new Date(fromTime);
  const toDate = new Date(toTime);

  const { status } = await MediaLibrary.getPermissionsAsync();
  if (status !== MediaLibrary.PermissionStatus.GRANTED) {
    return [];
  }

  const assets = await MediaLibrary.getAssetsAsync({
    mediaType: MediaLibrary.MediaType.photo,
    createdAfter: fromDate,
    createdBefore: toDate,
    sortBy: [MediaLibrary.SortBy.creationTime],
    first: 50,
  });

  type ScoredPhoto = MatchedPhoto & { score: number };
  const matches: ScoredPhoto[] = [];

  for (const asset of assets.assets) {
    const takenAt = asset.creationTime;
    if (takenAt < fromTime || takenAt > toTime) continue;

    let score = 1;
    let displayUri = asset.uri;

    try {
      const info = await MediaLibrary.getAssetInfoAsync(asset.id);

      if (options.excludeScreenshots && info.mediaSubtypes?.includes("screenshot")) {
        continue;
      }

      if (info.localUri) {
        displayUri = info.localUri;
      }
      if (info.location) {
        const dist = haversineM(stay.lat, stay.lng, info.location.latitude, info.location.longitude);
        if (dist <= GPS_RADIUS_M) {
          score = 2 + (1 - dist / GPS_RADIUS_M);
        } else {
          continue;
        }
      }
    } catch {
      // getAssetInfoAsync failed → match by time only
    }

    matches.push({
      stay_id: stay.id,
      asset_id: asset.id,
      uri: displayUri,
      width: asset.width,
      height: asset.height,
      taken_at: takenAt,
      score,
    });
  }

  matches.sort((a, b) => b.score - a.score);
  return matches.slice(0, MAX_PHOTOS_PER_STAY).map(({ score: _, ...photo }) => photo);
}

/**
 * Match photos for multiple stays in batch.
 */
export async function matchPhotosForStays(
  stays: Stay[],
  options: PhotoMatchOptions = {},
): Promise<Map<number, MatchedPhoto[]>> {
  const result = new Map<number, MatchedPhoto[]>();
  for (const stay of stays) {
    const photos = await matchPhotosForStay(stay, options);
    if (photos.length > 0) {
      result.set(stay.id, photos);
    }
  }
  return result;
}
