import { mapOsmTagToCategory, type PlaceCategory } from "@/core/places/categories";

export type PlaceResult = {
  name: string | null;
  category: PlaceCategory;
  osmTag: string;
  distance_m: number;
};

const OVERPASS_URL = "https://overpass-api.de/api/interpreter";
const SEARCH_RADIUS_M = 100;

/**
 * Query Overpass API for nearby amenities/shops at given coordinates.
 * Returns top results sorted by distance.
 */
export async function fetchNearbyPlaces(
  lat: number,
  lng: number,
): Promise<PlaceResult[]> {
  const query = `
    [out:json][timeout:10];
    (
      node["amenity"](around:${SEARCH_RADIUS_M},${lat},${lng});
      node["shop"](around:${SEARCH_RADIUS_M},${lat},${lng});
      node["leisure"](around:${SEARCH_RADIUS_M},${lat},${lng});
      node["railway"="station"](around:${SEARCH_RADIUS_M},${lat},${lng});
      node["railway"="halt"](around:${SEARCH_RADIUS_M},${lat},${lng});
      way["amenity"](around:${SEARCH_RADIUS_M},${lat},${lng});
      way["shop"](around:${SEARCH_RADIUS_M},${lat},${lng});
      way["leisure"](around:${SEARCH_RADIUS_M},${lat},${lng});
    );
    out center body 10;
  `;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);

  try {
    const res = await fetch(OVERPASS_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `data=${encodeURIComponent(query)}`,
      signal: controller.signal,
    });

    if (!res.ok) throw new Error(`Overpass ${res.status}`);

    const json = await res.json();
    const elements: Array<{
      tags?: Record<string, string>;
      lat?: number;
      lon?: number;
      center?: { lat: number; lon: number };
    }> = json.elements ?? [];

    return elements
      .map((el) => {
        const elLat = el.lat ?? el.center?.lat ?? lat;
        const elLng = el.lon ?? el.center?.lon ?? lng;
        const tags = el.tags ?? {};

        const osmTag =
          tags.amenity ?? tags.shop ?? tags.leisure ?? tags.railway ?? "other";
        const name = tags.name ?? tags["name:ja"] ?? null;
        const dLat = (elLat - lat) * 111_000;
        const dLng = (elLng - lng) * 91_000;
        const distance_m = Math.sqrt(dLat * dLat + dLng * dLng);

        return {
          name,
          category: mapOsmTagToCategory(osmTag),
          osmTag,
          distance_m: Math.round(distance_m),
        };
      })
      .sort((a, b) => a.distance_m - b.distance_m);
  } finally {
    clearTimeout(timeout);
  }
}
