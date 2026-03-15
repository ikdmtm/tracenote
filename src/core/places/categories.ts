export type PlaceCategory =
  | "restaurant"
  | "cafe"
  | "bar"
  | "gym"
  | "station"
  | "shop"
  | "office"
  | "school"
  | "hospital"
  | "park"
  | "hotel"
  | "convenience"
  | "supermarket"
  | "other";

const OSM_TAG_MAP: Record<string, PlaceCategory> = {
  restaurant: "restaurant",
  fast_food: "restaurant",
  food_court: "restaurant",
  cafe: "cafe",
  bar: "bar",
  pub: "bar",
  nightclub: "bar",
  fitness_centre: "gym",
  gym: "gym",
  sports_centre: "gym",
  station: "station",
  bus_station: "station",
  subway_entrance: "station",
  halt: "station",
  shop: "shop",
  supermarket: "supermarket",
  marketplace: "supermarket",
  convenience: "convenience",
  office: "office",
  coworking_space: "office",
  school: "school",
  university: "school",
  college: "school",
  library: "school",
  hospital: "hospital",
  clinic: "hospital",
  doctors: "hospital",
  pharmacy: "hospital",
  park: "park",
  garden: "park",
  playground: "park",
  hotel: "hotel",
  hostel: "hotel",
  guest_house: "hotel",
};

export function mapOsmTagToCategory(tag: string): PlaceCategory {
  return OSM_TAG_MAP[tag] ?? "other";
}

export const CATEGORY_LABELS: Record<PlaceCategory, string> = {
  restaurant: "飲食店",
  cafe: "カフェ",
  bar: "バー",
  gym: "ジム",
  station: "駅",
  shop: "ショップ",
  office: "オフィス",
  school: "学校",
  hospital: "病院",
  park: "公園",
  hotel: "ホテル",
  convenience: "コンビニ",
  supermarket: "スーパー",
  other: "その他",
};
