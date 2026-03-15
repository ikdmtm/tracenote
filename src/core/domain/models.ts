export type RawEvent = {
  id: number;
  ts: number;
  lat: number;
  lng: number;
  acc: number;
  source: string;
};

export type Stay = {
  id: number;
  start_ts: number;
  end_ts: number;
  lat: number;
  lng: number;
  radius_m: number;
  place_json: string | null;
  activity: string | null;
  confidence: number;
  needs_review: boolean;
  user_place_name: string | null;
  memo: string | null;
};

export type DiaryEntry = {
  id: number;
  day_key: string;
  title: string | null;
  body: string | null;
  highlights_json: string | null;
  share_text: string | null;
};

export type StayPhoto = {
  id: number;
  stay_id: number;
  asset_id: string;
  uri: string;
  width: number;
  height: number;
  taken_at: number;
};

export type MovementRow = {
  id: number;
  from_stay_id: number;
  to_stay_id: number;
  start_ts: number;
  end_ts: number;
  distance_m: number;
  duration_min: number;
  avg_speed_kmh: number;
  mode: string;
  user_mode: string | null;
};
