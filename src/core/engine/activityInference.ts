import type { PlaceCategory } from "@/core/places/categories";
import { NEEDS_REVIEW } from "@/core/constants";

export type Activity = "home" | "meal" | "workout" | "work" | "commute" | "rest" | "shopping" | "outing" | "other";

export const ACTIVITY_LABELS: Record<Activity, string> = {
  home: "自宅",
  meal: "食事",
  workout: "トレーニング",
  work: "仕事・作業",
  commute: "移動",
  rest: "休憩",
  shopping: "買い物",
  outing: "お出かけ",
  other: "その他の滞在",
};

type InferenceInput = {
  category: PlaceCategory | null;
  startHour: number;
  durationMin: number;
  accuracy: number;
};

type InferenceResult = {
  activity: Activity;
  confidence: number;
  needs_review: boolean;
  reason: string | null;
};

export function inferActivity(input: InferenceInput): InferenceResult {
  const { category, startHour, durationMin, accuracy } = input;

  // Accuracy too low → always needs review
  if (accuracy > NEEDS_REVIEW.ACCURACY_THRESHOLD_M) {
    return {
      activity: "other",
      confidence: 0.2,
      needs_review: true,
      reason: "精度が低い",
    };
  }

  // No place info: likely residential area
  if (!category) {
    // Long stay during night hours → probably home
    if (durationMin >= 180 && (startHour >= 21 || startHour < 8)) {
      return { activity: "home", confidence: 0.6, needs_review: false, reason: null };
    }
    return {
      activity: "other",
      confidence: 0.3,
      needs_review: true,
      reason: "場所不明",
    };
  }

  // Meal: restaurant/cafe during meal hours, 20-120 min
  if (
    (category === "restaurant" || category === "cafe") &&
    ((startHour >= 6 && startHour < 10) ||
      (startHour >= 11 && startHour < 14) ||
      (startHour >= 17 && startHour < 21)) &&
    durationMin >= 20 &&
    durationMin <= 120
  ) {
    return { activity: "meal", confidence: 0.85, needs_review: false, reason: null };
  }

  // Cafe outside meal hours → rest
  if (category === "cafe") {
    return { activity: "rest", confidence: 0.6, needs_review: false, reason: null };
  }

  // Restaurant outside meal time patterns
  if (category === "restaurant") {
    return { activity: "meal", confidence: 0.6, needs_review: false, reason: null };
  }

  // Workout: gym, 30-180 min
  if (category === "gym" && durationMin >= 30 && durationMin <= 180) {
    return { activity: "workout", confidence: 0.85, needs_review: false, reason: null };
  }

  if (category === "gym") {
    return {
      activity: "workout",
      confidence: 0.5,
      needs_review: true,
      reason: "ジムだが滞在時間が想定外",
    };
  }

  // Station → commute (short stays only)
  if (category === "station" && durationMin <= 30) {
    return { activity: "commute", confidence: 0.7, needs_review: false, reason: null };
  }

  // Shopping
  if (
    (category === "shop" || category === "supermarket" || category === "convenience") &&
    durationMin >= 5 &&
    durationMin <= 90
  ) {
    return { activity: "shopping", confidence: 0.7, needs_review: false, reason: null };
  }

  // Office → work
  if (category === "office") {
    return { activity: "work", confidence: 0.7, needs_review: false, reason: null };
  }

  // School → work
  if (category === "school") {
    return { activity: "work", confidence: 0.6, needs_review: false, reason: null };
  }

  // Park → rest
  if (category === "park") {
    return { activity: "rest", confidence: 0.5, needs_review: false, reason: null };
  }

  // Bar → outing
  if (category === "bar") {
    return { activity: "outing", confidence: 0.7, needs_review: false, reason: null };
  }

  // Hotel → rest
  if (category === "hotel") {
    return { activity: "rest", confidence: 0.5, needs_review: false, reason: null };
  }

  // Hospital
  if (category === "hospital") {
    return { activity: "outing", confidence: 0.5, needs_review: true, reason: "通院？" };
  }

  // Duration too short or too long → needs review
  if (durationMin < 20 || durationMin > 600) {
    return {
      activity: "other",
      confidence: 0.3,
      needs_review: true,
      reason: durationMin < 20 ? "滞在が短い" : "滞在が長すぎる",
    };
  }

  // Fallback
  return { activity: "other", confidence: 0.4, needs_review: true, reason: "推定困難" };
}
