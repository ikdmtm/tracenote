import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import type { Stay, StayPhoto } from "@/core/domain/models";
import { ACTIVITY_LABELS, type Activity } from "@/core/engine/activityInference";
import type { HomeLocation } from "@/core/engine/homeDetector";
import { isHomeStay } from "@/core/engine/homeDetector";
import {
  estimateMovements,
  MOVEMENT_LABELS,
} from "@/core/engine/movementEstimator";
import { CATEGORY_LABELS, type PlaceCategory } from "@/core/places/categories";

const CARD_W = 1080;
const CARD_H = 1920;
const SCALE = 0.3;

export type ShareCardProps = {
  date: Date;
  stays: Stay[];
  photoMap: Record<number, StayPhoto[]>;
  home: HomeLocation | null;
};

function formatDate(d: Date): string {
  const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${weekdays[d.getDay()]}, ${months[d.getMonth()]} ${d.getDate()}`;
}

function formatDateJp(d: Date): string {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function durationLabel(startTs: number, endTs: number): string {
  const mins = Math.round((endTs - startTs) / 60_000);
  if (mins < 60) return `${mins}分`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function resolvePlaceName(stay: Stay, home: HomeLocation | null): string {
  if (isHomeStay(stay, home)) return "自宅";
  if (stay.user_place_name) return stay.user_place_name;
  if (stay.place_json) {
    try {
      const parsed = JSON.parse(stay.place_json);
      if (parsed.top?.name) return parsed.top.name;
      if (parsed.top?.category && parsed.top.category !== "other") {
        return CATEGORY_LABELS[parsed.top.category as PlaceCategory] ?? parsed.top.category;
      }
    } catch {}
  }
  if (stay.activity) {
    return ACTIVITY_LABELS[stay.activity as Activity] ?? "滞在";
  }
  return "滞在";
}

const ACTIVITY_ICON: Record<string, string> = {
  home: "home",
  meal: "restaurant",
  workout: "barbell",
  work: "briefcase",
  commute: "train",
  rest: "cafe",
  shopping: "bag",
  outing: "walk",
  other: "location",
};

function findHeroPhoto(
  stays: Stay[],
  photoMap: Record<number, StayPhoto[]>,
  home: HomeLocation | null,
): StayPhoto | null {
  for (const stay of stays) {
    if (isHomeStay(stay, home)) continue;
    const photos = photoMap[stay.id];
    if (photos && photos.length > 0) {
      const valid = photos.find((p) => p.uri && !p.uri.startsWith("ph://"));
      if (valid) return valid;
    }
  }
  return null;
}

/**
 * ShareCard rendered at 1080x1920 logical px, scaled down for preview.
 * The viewRef capture should use the unscaled version.
 */
export const ShareCard = React.forwardRef<View, ShareCardProps>(
  ({ date, stays, photoMap, home }, ref) => {
    const heroPhoto = findHeroPhoto(stays, photoMap, home);
    const movements = estimateMovements(stays);
    const totalDistanceM = movements.reduce((s, m) => s + m.distance_m, 0);
    const totalPhotos = Object.values(photoMap).reduce((s, arr) => s + arr.length, 0);

    const highlights = [...stays]
      .filter((s) => !isHomeStay(s, home))
      .sort((a, b) => (b.end_ts - b.start_ts) - (a.end_ts - a.start_ts))
      .slice(0, 5);

    return (
      <View ref={ref} style={s.card} collapsable={false}>
        {/* Background gradient */}
        <View style={s.bgGradient} />

        {/* Hero photo area */}
        {heroPhoto && heroPhoto.uri && (
          <View style={s.heroWrap}>
            <Image source={{ uri: heroPhoto.uri }} style={s.heroImage} resizeMode="cover" />
            <View style={s.heroOverlay} />
          </View>
        )}

        {/* Top section - date */}
        <View style={s.topSection}>
          <Text style={s.dateEn}>{formatDate(date)}</Text>
          <Text style={s.dateJp}>{formatDateJp(date)}</Text>
        </View>

        {/* Stats bar */}
        <View style={s.statsBar}>
          <View style={s.statBox}>
            <Text style={s.statNum}>{stays.length}</Text>
            <Text style={s.statUnit}>滞在</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statNum}>{formatDistance(totalDistanceM)}</Text>
            <Text style={s.statUnit}>移動距離</Text>
          </View>
          <View style={s.statDivider} />
          <View style={s.statBox}>
            <Text style={s.statNum}>{totalPhotos}</Text>
            <Text style={s.statUnit}>写真</Text>
          </View>
        </View>

        {/* Timeline highlights */}
        <View style={s.timeline}>
          {highlights.map((stay, idx) => {
            const name = resolvePlaceName(stay, home);
            const icon = ACTIVITY_ICON[stay.activity ?? ""] ?? "location";
            const moveAfter = movements.find((m) => m.from_stay_id === stay.id);

            return (
              <React.Fragment key={stay.id}>
                <View style={s.tlRow}>
                  <View style={s.tlTimeCol}>
                    <Text style={s.tlTime}>{formatTime(stay.start_ts)}</Text>
                  </View>
                  <View style={s.tlDotCol}>
                    <View style={s.tlDot}>
                      <Ionicons name={icon as any} size={16} color="#ffffff" />
                    </View>
                    {idx < highlights.length - 1 && <View style={s.tlLine} />}
                  </View>
                  <View style={s.tlContent}>
                    <Text style={s.tlName} numberOfLines={1}>{name}</Text>
                    <Text style={s.tlDuration}>{durationLabel(stay.start_ts, stay.end_ts)}</Text>
                  </View>
                </View>
                {moveAfter && idx < highlights.length - 1 && (
                  <View style={s.tlMoveRow}>
                    <View style={s.tlTimeCol} />
                    <View style={s.tlDotCol}>
                      <View style={s.tlMoveLine} />
                    </View>
                    <View style={s.tlMoveContent}>
                      <Text style={s.tlMoveText}>
                        {MOVEMENT_LABELS[moveAfter.mode]} {formatDistance(moveAfter.distance_m)}
                      </Text>
                    </View>
                  </View>
                )}
              </React.Fragment>
            );
          })}
        </View>

        {/* Footer branding */}
        <View style={s.footer}>
          <View style={s.footerLine} />
          <View style={s.brandRow}>
            <Ionicons name="footsteps" size={18} color="rgba(255,255,255,0.6)" />
            <Text style={s.brandText}>TraceNote</Text>
          </View>
        </View>
      </View>
    );
  },
);

const s = StyleSheet.create({
  card: {
    width: CARD_W * SCALE,
    height: CARD_H * SCALE,
    backgroundColor: "#0f172a",
    borderRadius: 20,
    overflow: "hidden",
    position: "relative",
  },
  bgGradient: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0f172a",
  },
  heroWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: CARD_H * SCALE * 0.4,
  },
  heroImage: {
    width: "100%",
    height: "100%",
  },
  heroOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(15,23,42,0.55)",
  },
  topSection: {
    paddingHorizontal: 24,
    paddingTop: 32,
    zIndex: 1,
  },
  dateEn: {
    fontSize: 13,
    fontWeight: "700",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
  },
  dateJp: {
    fontSize: 22,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 4,
  },
  statsBar: {
    flexDirection: "row",
    marginHorizontal: 24,
    marginTop: 20,
    backgroundColor: "rgba(255,255,255,0.08)",
    borderRadius: 12,
    paddingVertical: 12,
    zIndex: 1,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNum: {
    fontSize: 18,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: "#ffffff",
  },
  statUnit: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  timeline: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 20,
    zIndex: 1,
  },
  tlRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 4,
  },
  tlTimeCol: {
    width: 44,
    alignItems: "flex-end",
    paddingRight: 10,
  },
  tlTime: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    color: "rgba(255,255,255,0.5)",
    marginTop: 4,
  },
  tlDotCol: {
    width: 28,
    alignItems: "center",
  },
  tlDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  tlLine: {
    width: 2,
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.12)",
    minHeight: 16,
  },
  tlContent: {
    flex: 1,
    paddingLeft: 10,
  },
  tlName: {
    fontSize: 15,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 3,
  },
  tlDuration: {
    fontSize: 11,
    color: "rgba(255,255,255,0.45)",
    marginTop: 2,
    marginBottom: 4,
  },
  tlMoveRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 4,
  },
  tlMoveLine: {
    width: 2,
    height: 16,
    backgroundColor: "rgba(255,255,255,0.08)",
    alignSelf: "center",
  },
  tlMoveContent: {
    paddingLeft: 10,
  },
  tlMoveText: {
    fontSize: 10,
    color: "rgba(255,255,255,0.35)",
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 24,
    zIndex: 1,
  },
  footerLine: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.08)",
    marginBottom: 12,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
  },
  brandText: {
    fontSize: 14,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.6)",
  },
});
