import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Stay } from "@/core/domain/models";
import { ACTIVITY_LABELS, type Activity } from "@/core/engine/activityInference";
import { CATEGORY_LABELS, type PlaceCategory } from "@/core/places/categories";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function durationLabel(startTs: number, endTs: number): string {
  const mins = Math.round((endTs - startTs) / 60_000);
  if (mins < 60) return `${mins}分`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

function confidenceColor(conf: number): string {
  if (conf >= 0.7) return "#16a34a";
  if (conf >= 0.4) return "#d97706";
  return "#dc2626";
}

function parsePlaceJson(json: string | null): { name: string | null; category: PlaceCategory | null } {
  if (!json) return { name: null, category: null };
  try {
    const parsed = JSON.parse(json);
    return {
      name: parsed.top?.name ?? null,
      category: parsed.top?.category ?? null,
    };
  } catch {
    return { name: null, category: null };
  }
}

function resolveDisplayName(stay: Stay): string {
  if (stay.user_place_name) return stay.user_place_name;

  const { name } = parsePlaceJson(stay.place_json);
  if (name) return name;

  const { category } = parsePlaceJson(stay.place_json);
  if (category && category !== "other") return CATEGORY_LABELS[category];

  return `滞在地点 (${stay.lat.toFixed(4)}, ${stay.lng.toFixed(4)})`;
}

function activityLabel(activity: string | null): string | null {
  if (!activity) return null;
  return ACTIVITY_LABELS[activity as Activity] ?? activity;
}

const ACTIVITY_ICON: Record<string, string> = {
  meal: "restaurant-outline",
  workout: "barbell-outline",
  work: "briefcase-outline",
  commute: "train-outline",
  rest: "cafe-outline",
  shopping: "bag-outline",
  other: "ellipsis-horizontal",
};

export function StayCard({ stay }: { stay: Stay }) {
  const router = useRouter();
  const displayName = resolveDisplayName(stay);
  const label = activityLabel(stay.activity);
  const icon = ACTIVITY_ICON[stay.activity ?? ""] ?? "location-outline";

  return (
    <Pressable
      style={styles.card}
      onPress={() => router.push({ pathname: "/edit-stay", params: { id: String(stay.id) } })}
    >
      <View style={styles.timeColumn}>
        <Text style={styles.timeText}>{formatTime(stay.start_ts)}</Text>
        <View style={styles.timeLine} />
        <Text style={styles.timeText}>{formatTime(stay.end_ts)}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Ionicons name={icon as any} size={16} color="#64748b" style={{ marginRight: 4 }} />
          <Text style={styles.placeName} numberOfLines={1}>
            {displayName}
          </Text>
          {stay.needs_review && (
            <View style={styles.reviewBadge}>
              <Text style={styles.reviewText}>要確認</Text>
            </View>
          )}
        </View>

        <View style={styles.subRow}>
          {label && <Text style={styles.activityChip}>{label}</Text>}
          <Text style={styles.duration}>
            {durationLabel(stay.start_ts, stay.end_ts)}
          </Text>
        </View>

        <View style={styles.footer}>
          <View style={styles.confRow}>
            <View
              style={[
                styles.confDot,
                { backgroundColor: confidenceColor(stay.confidence) },
              ]}
            />
            <Text style={styles.confText}>
              {Math.round(stay.confidence * 100)}%
            </Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color="#cbd5e1" />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  timeColumn: {
    alignItems: "center",
    width: 48,
    marginRight: 12,
  },
  timeText: {
    fontSize: 12,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: "#64748b",
  },
  timeLine: {
    flex: 1,
    width: 2,
    backgroundColor: "#e2e8f0",
    marginVertical: 4,
    borderRadius: 1,
  },
  content: {
    flex: 1,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  placeName: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
    flex: 1,
  },
  reviewBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  reviewText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#d97706",
  },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 4,
  },
  activityChip: {
    fontSize: 12,
    fontWeight: "500",
    color: "#3b82f6",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  duration: {
    fontSize: 13,
    color: "#64748b",
  },
  footer: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 8,
  },
  confRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  confDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  confText: {
    fontSize: 12,
    color: "#94a3b8",
  },
});
