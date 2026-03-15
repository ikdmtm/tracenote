export const LOCATION = {
  TIME_INTERVAL_MS: 180_000,
  DISTANCE_FILTER_M: 50,
  ACCURACY_THRESHOLD_M: 80,
  HIGH_ACCURACY_TIMEOUT_S: 30,
} as const;

export const STAY = {
  MIN_DURATION_MIN: 20,
  MERGE_RADIUS_M: 150,
} as const;

export const HOME = {
  DETECTION_RANGE_START_H: 0,
  DETECTION_RANGE_END_H: 6,
} as const;

export const DIARY = {
  DEFAULT_DAY_END_TIME: "00:00",
  DEFAULT_GENERATION_TIME: "07:00",
} as const;

export const TOKEN = {
  RESERVE_MIN: 1024,
  RESERVE_RATIO: 0.15,
  SAFE_THRESHOLD_RATIO: 0.80,
} as const;

export const NEEDS_REVIEW = {
  ACCURACY_THRESHOLD_M: 200,
} as const;
