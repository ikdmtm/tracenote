import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";

import i18n from "@/i18n";
import { useTranslation } from "react-i18next";
import type { Stay, StayPhoto } from "@/core/domain/models";
import { getActivityLabel } from "@/core/engine/activityInference";
import { getCategoryLabel, type PlaceCategory } from "@/core/places/categories";
import { useTheme } from "@/features/theme/ThemeContext";

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
  if (category && category !== "other") return getCategoryLabel(category);

  return `${i18n.t("stayCard.stayAt")} (${stay.lat.toFixed(4)}, ${stay.lng.toFixed(4)})`;
}

const ACTIVITY_ICON: Record<string, string> = {
  home: "home-outline",
  meal: "restaurant-outline",
  workout: "barbell-outline",
  work: "briefcase-outline",
  commute: "train-outline",
  rest: "cafe-outline",
  shopping: "bag-outline",
  outing: "walk-outline",
  other: "location-outline",
};

const MAX_THUMBNAILS = 3;

type StayCardProps = {
  stay: Stay;
  photos?: StayPhoto[];
};

export function StayCard({ stay, photos }: StayCardProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const { theme: themeColors } = useTheme();
  const displayName = resolveDisplayName(stay);
  const label = stay.activity ? getActivityLabel(stay.activity) : null;
  const icon = ACTIVITY_ICON[stay.activity ?? ""] ?? "location-outline";
  const thumbs = (photos ?? []).slice(0, MAX_THUMBNAILS);
  const extraCount = (photos?.length ?? 0) - MAX_THUMBNAILS;

  return (
    <Pressable
      style={[styles.card, { backgroundColor: themeColors.surface }]}
      onPress={() => router.push({ pathname: "/stay-detail", params: { id: String(stay.id) } })}
    >
      <View style={styles.timeColumn}>
        <Text style={[styles.timeText, { color: themeColors.textSecondary }]}>{formatTime(stay.start_ts)}</Text>
        <View style={[styles.timeLine, { backgroundColor: themeColors.surfaceBorder }]} />
        <Text style={[styles.timeText, { color: themeColors.textSecondary }]}>{formatTime(stay.end_ts)}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.headerRow}>
          <Ionicons name={icon as any} size={16} color={themeColors.textSecondary} style={{ marginRight: 4 }} />
          <Text style={[styles.placeName, { color: themeColors.text }]} numberOfLines={1}>
            {displayName}
          </Text>
          {stay.needs_review && (
            <View style={[styles.reviewBadge, { backgroundColor: "#fef3c7" }]}>
              <Text style={styles.reviewText}>{t("stayCard.needsReview")}</Text>
            </View>
          )}
        </View>

        <View style={styles.subRow}>
          {label && (
            <Text style={[styles.activityChip, { color: themeColors.primary, backgroundColor: themeColors.primaryLight }]}>
              {label}
            </Text>
          )}
          <Text style={[styles.duration, { color: themeColors.textSecondary }]}>
            {durationLabel(stay.start_ts, stay.end_ts)}
          </Text>
        </View>

        {thumbs.length > 0 && (
          <View style={styles.photoRow}>
            {thumbs.map((p) => (
              p.uri && !p.uri.startsWith("ph://") ? (
                <Image key={p.id} source={{ uri: p.uri }} style={[styles.thumbnail, { backgroundColor: themeColors.divider }]} />
              ) : (
                <View key={p.id} style={[styles.thumbnail, styles.photoFallback, { backgroundColor: themeColors.divider }]}>
                  <Ionicons name="image-outline" size={18} color={themeColors.textMuted} />
                </View>
              )
            ))}
            {extraCount > 0 && (
              <View style={[styles.extraBadge, { backgroundColor: themeColors.divider }]}>
                <Text style={[styles.extraText, { color: themeColors.textSecondary }]}>+{extraCount}</Text>
              </View>
            )}
          </View>
        )}

        <View style={styles.footer}>
          <View style={styles.confRow}>
            <View style={[styles.confDot, { backgroundColor: confidenceColor(stay.confidence) }]} />
            <Text style={[styles.confText, { color: themeColors.textMuted }]}>{Math.round(stay.confidence * 100)}%</Text>
          </View>
          <Ionicons name="chevron-forward" size={16} color={themeColors.textMuted} />
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: "row",
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
  },
  timeLine: {
    flex: 1,
    width: 2,
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
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
  },
  duration: {
    fontSize: 13,
  },
  photoRow: {
    flexDirection: "row",
    gap: 6,
    marginTop: 8,
    alignItems: "center",
  },
  thumbnail: {
    width: 44,
    height: 44,
    borderRadius: 6,
  },
  photoFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  extraBadge: {
    width: 44,
    height: 44,
    borderRadius: 6,
    justifyContent: "center",
    alignItems: "center",
  },
  extraText: {
    fontSize: 12,
    fontWeight: "600",
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
  },
});
