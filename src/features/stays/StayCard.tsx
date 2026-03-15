import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";

import type { Stay } from "@/core/domain/models";

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

export function StayCard({ stay }: { stay: Stay }) {
  const router = useRouter();
  const placeName = stay.user_place_name ?? stay.activity ?? "不明な場所";

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
          <Text style={styles.placeName} numberOfLines={1}>
            {placeName}
          </Text>
          {stay.needs_review && (
            <View style={styles.reviewBadge}>
              <Text style={styles.reviewText}>要確認</Text>
            </View>
          )}
        </View>

        <Text style={styles.duration}>
          {durationLabel(stay.start_ts, stay.end_ts)}
        </Text>

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
  duration: {
    fontSize: 13,
    color: "#64748b",
    marginTop: 4,
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
