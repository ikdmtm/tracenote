import type { Stay } from "@/core/domain/models";
import { distanceM } from "@/core/engine/geo";

export type MovementMode = "walk" | "bicycle" | "train" | "car" | "airplane" | "unknown";

export type Movement = {
  from_stay_id: number;
  to_stay_id: number;
  start_ts: number;
  end_ts: number;
  distance_m: number;
  duration_min: number;
  avg_speed_kmh: number;
  mode: MovementMode;
};

export const MOVEMENT_LABELS: Record<MovementMode, string> = {
  walk: "徒歩",
  bicycle: "自転車",
  train: "電車",
  car: "車",
  airplane: "飛行機",
  unknown: "移動",
};

export const MOVEMENT_ICONS: Record<MovementMode, string> = {
  walk: "walk-outline",
  bicycle: "bicycle-outline",
  train: "train-outline",
  car: "car-outline",
  airplane: "airplane-outline",
  unknown: "swap-horizontal-outline",
};

function classifyMode(speedKmh: number): MovementMode {
  if (speedKmh <= 0) return "unknown";
  if (speedKmh <= 6) return "walk";
  if (speedKmh <= 25) return "bicycle";
  if (speedKmh <= 300) return "train";
  return "airplane";
}

export function estimateMovements(stays: readonly Stay[]): Movement[] {
  if (stays.length < 2) return [];

  const movements: Movement[] = [];
  for (let i = 0; i < stays.length - 1; i++) {
    const from = stays[i];
    const to = stays[i + 1];

    const dist = distanceM(from.lat, from.lng, to.lat, to.lng);
    const durationMs = to.start_ts - from.end_ts;
    const durationMin = Math.max(1, Math.round(durationMs / 60_000));
    const durationH = durationMs / 3_600_000;
    const speedKmh = durationH > 0 ? (dist / 1000) / durationH : 0;

    movements.push({
      from_stay_id: from.id,
      to_stay_id: to.id,
      start_ts: from.end_ts,
      end_ts: to.start_ts,
      distance_m: Math.round(dist),
      duration_min: durationMin,
      avg_speed_kmh: Math.round(speedKmh * 10) / 10,
      mode: classifyMode(speedKmh),
    });
  }

  return movements;
}
