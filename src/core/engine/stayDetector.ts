import type { RawEvent } from "@/core/domain/models";
import { STAY } from "@/core/constants";
import { centroid, clusterRadius, distanceM } from "@/core/engine/geo";

export type DetectedStay = {
  start_ts: number;
  end_ts: number;
  lat: number;
  lng: number;
  radius_m: number;
  confidence: number;
  event_count: number;
};

/**
 * Detect stays from a sorted list of RawEvents.
 *
 * Algorithm:
 * 1. Walk events in time order, accumulating a "cluster" while each new
 *    point is within MERGE_RADIUS of the cluster centroid.
 * 2. When a point falls outside the radius, finalize the current cluster
 *    if it lasted >= MIN_DURATION.
 * 3. Merge adjacent stays whose centroids are within MERGE_RADIUS.
 */
export function detectStays(events: readonly RawEvent[]): DetectedStay[] {
  if (events.length < 2) return [];

  const minDurationMs = STAY.MIN_DURATION_MIN * 60 * 1000;
  const mergeRadius = STAY.MERGE_RADIUS_M;

  const raw: DetectedStay[] = [];
  let clusterEvents: RawEvent[] = [events[0]];

  for (let i = 1; i < events.length; i++) {
    const ev = events[i];
    const center = centroid(clusterEvents);
    const dist = distanceM(center.lat, center.lng, ev.lat, ev.lng);

    if (dist <= mergeRadius) {
      clusterEvents.push(ev);
    } else {
      const stay = tryFinalize(clusterEvents, minDurationMs);
      if (stay) raw.push(stay);
      clusterEvents = [ev];
    }
  }

  const lastStay = tryFinalize(clusterEvents, minDurationMs);
  if (lastStay) raw.push(lastStay);

  return mergeAdjacentStays(raw, mergeRadius);
}

function tryFinalize(
  events: RawEvent[],
  minDurationMs: number,
): DetectedStay | null {
  if (events.length < 2) return null;

  const start = events[0].ts;
  const end = events[events.length - 1].ts;
  if (end - start < minDurationMs) return null;

  const center = centroid(events);
  const radius = clusterRadius(center, events);

  const avgAcc =
    events.reduce((sum, e) => sum + (e.acc > 0 ? e.acc : 100), 0) /
    events.length;
  const confidence = Math.max(0, Math.min(1, 1 - avgAcc / 500));

  return {
    start_ts: start,
    end_ts: end,
    lat: center.lat,
    lng: center.lng,
    radius_m: Math.round(radius),
    confidence: Math.round(confidence * 100) / 100,
    event_count: events.length,
  };
}

function mergeAdjacentStays(
  stays: DetectedStay[],
  mergeRadius: number,
): DetectedStay[] {
  if (stays.length <= 1) return stays;

  const merged: DetectedStay[] = [stays[0]];

  for (let i = 1; i < stays.length; i++) {
    const prev = merged[merged.length - 1];
    const curr = stays[i];
    const dist = distanceM(prev.lat, prev.lng, curr.lat, curr.lng);

    if (dist <= mergeRadius) {
      const totalEvents = prev.event_count + curr.event_count;
      merged[merged.length - 1] = {
        start_ts: prev.start_ts,
        end_ts: curr.end_ts,
        lat: (prev.lat * prev.event_count + curr.lat * curr.event_count) / totalEvents,
        lng: (prev.lng * prev.event_count + curr.lng * curr.event_count) / totalEvents,
        radius_m: Math.max(prev.radius_m, curr.radius_m),
        confidence: (prev.confidence + curr.confidence) / 2,
        event_count: totalEvents,
      };
    } else {
      merged.push(curr);
    }
  }

  return merged;
}
