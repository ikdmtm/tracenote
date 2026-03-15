const R_EARTH_M = 6_371_000;

/** Haversine distance in meters between two lat/lng points */
export function distanceM(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R_EARTH_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Centroid of a set of lat/lng points */
export function centroid(
  points: ReadonlyArray<{ lat: number; lng: number }>,
): { lat: number; lng: number } {
  if (points.length === 0) return { lat: 0, lng: 0 };

  let sumLat = 0;
  let sumLng = 0;
  for (const p of points) {
    sumLat += p.lat;
    sumLng += p.lng;
  }
  return { lat: sumLat / points.length, lng: sumLng / points.length };
}

/** Max distance from centroid to any point (radius of cluster) */
export function clusterRadius(
  center: { lat: number; lng: number },
  points: ReadonlyArray<{ lat: number; lng: number }>,
): number {
  let max = 0;
  for (const p of points) {
    const d = distanceM(center.lat, center.lng, p.lat, p.lng);
    if (d > max) max = d;
  }
  return max;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
