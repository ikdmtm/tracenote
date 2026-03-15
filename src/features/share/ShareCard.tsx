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
  MOVEMENT_ICONS,
  type Movement,
} from "@/core/engine/movementEstimator";
import { CATEGORY_LABELS, type PlaceCategory } from "@/core/places/categories";

const SCALE = 0.3;
const W = 1080 * SCALE;
const H = 1920 * SCALE;

const SAFE_TOP = H * 0.14;
const SAFE_BOTTOM = H * 0.14;

const MAX_STAYS_NORMAL = 7;
const MAX_STAYS_COMPACT = 10;

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

function resolvePlaceName(stay: Stay): string {
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

function getStayPhoto(stay: Stay, photoMap: Record<number, StayPhoto[]>): StayPhoto | null {
  const photos = photoMap[stay.id];
  if (!photos || photos.length === 0) return null;
  return photos.find((p) => p.uri && !p.uri.startsWith("ph://")) ?? null;
}

function buildShareTimeline(
  stays: Stay[],
  home: HomeLocation | null,
): { visibleStays: Stay[]; movementsBetween: Map<number, Movement> } {
  const nonHome = stays.filter((s) => !isHomeStay(s, home));

  const nonHomeIds = new Set(nonHome.map((s) => s.id));
  const allMovements = estimateMovements(stays);

  const movementsBetween = new Map<number, Movement>();
  for (let i = 0; i < nonHome.length - 1; i++) {
    const to = nonHome[i + 1];
    const move = allMovements.find(
      (m) => nonHomeIds.has(m.from_stay_id) && m.to_stay_id === to.id,
    );
    if (move) {
      movementsBetween.set(to.id, move);
    }
  }

  return { visibleStays: nonHome, movementsBetween };
}

export const ShareCard = React.forwardRef<View, ShareCardProps>(
  ({ date, stays, photoMap, home }, ref) => {
    const { visibleStays, movementsBetween } = buildShareTimeline(stays, home);

    const nonHomeMovements = estimateMovements(stays).filter((m) => {
      const from = stays.find((s) => s.id === m.from_stay_id);
      const to = stays.find((s) => s.id === m.to_stay_id);
      return from && to && !isHomeStay(from, home) && !isHomeStay(to, home);
    });
    const totalDistanceM = nonHomeMovements.reduce((sum, m) => sum + m.distance_m, 0);
    const nonHomePhotos = visibleStays.reduce(
      (sum, s) => sum + (photoMap[s.id]?.length ?? 0), 0,
    );

    const totalVisible = visibleStays.length;
    const compact = totalVisible > MAX_STAYS_NORMAL;
    const maxDisplay = compact ? MAX_STAYS_COMPACT : MAX_STAYS_NORMAL;
    const displayed = visibleStays.slice(0, maxDisplay);
    const overflowCount = totalVisible - displayed.length;
    const showMovements = !compact;

    return (
      <View ref={ref} style={cs.card} collapsable={false}>
        <View style={cs.bg} />

        <View style={{ height: SAFE_TOP }} />

        {/* Date header */}
        <View style={cs.dateSection}>
          <Text style={cs.dateEn}>{formatDate(date)}</Text>
          <Text style={cs.dateJp}>{formatDateJp(date)}</Text>
        </View>

        {/* Stats */}
        <View style={cs.statsBar}>
          <View style={cs.statBox}>
            <Text style={cs.statNum}>{totalVisible}</Text>
            <Text style={cs.statUnit}>お出かけ</Text>
          </View>
          <View style={cs.statDiv} />
          <View style={cs.statBox}>
            <Text style={cs.statNum}>{formatDistance(totalDistanceM)}</Text>
            <Text style={cs.statUnit}>移動距離</Text>
          </View>
          <View style={cs.statDiv} />
          <View style={cs.statBox}>
            <Text style={cs.statNum}>{nonHomePhotos}</Text>
            <Text style={cs.statUnit}>写真</Text>
          </View>
        </View>

        {/* Timeline - chronological order */}
        <View style={cs.timeline}>
          {displayed.map((stay, idx) => {
            const name = resolvePlaceName(stay);
            const icon = ACTIVITY_ICON[stay.activity ?? ""] ?? "location";
            const photo = getStayPhoto(stay, photoMap);
            const move = movementsBetween.get(stay.id);
            const isLast = idx === displayed.length - 1 && overflowCount === 0;

            const dotSize = compact ? 22 : 26;
            const iconSize = compact ? 11 : 14;
            const nameSize = compact ? 12 : 14;
            const durSize = compact ? 9 : 10;
            const thumbSize = compact ? 30 : 36;
            const pb = compact ? 3 : 6;

            return (
              <React.Fragment key={stay.id}>
                {showMovements && move && (
                  <View style={cs.moveRow}>
                    <View style={cs.tlTimeCol} />
                    <View style={cs.tlDotCol}>
                      <View style={cs.moveDotLine} />
                    </View>
                    <View style={cs.moveContent}>
                      <Ionicons
                        name={MOVEMENT_ICONS[move.mode] as any}
                        size={10}
                        color="rgba(255,255,255,0.35)"
                      />
                      <Text style={cs.moveText}>
                        {MOVEMENT_LABELS[move.mode]} {formatDistance(move.distance_m)}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={cs.stayRow}>
                  <View style={cs.tlTimeCol}>
                    <Text style={[cs.tlTime, { marginTop: compact ? 3 : 5 }]}>
                      {formatTime(stay.start_ts)}
                    </Text>
                  </View>
                  <View style={cs.tlDotCol}>
                    <View style={[cs.dot, { width: dotSize, height: dotSize, borderRadius: dotSize / 2 }]}>
                      <Ionicons name={icon as any} size={iconSize} color="#ffffff" />
                    </View>
                    {!isLast && <View style={cs.dotLine} />}
                  </View>
                  <View style={[cs.stayContent, { paddingBottom: pb }]}>
                    <View style={cs.stayHeader}>
                      <View style={cs.stayInfo}>
                        <Text style={[cs.stayName, { fontSize: nameSize }]} numberOfLines={1}>
                          {name}
                        </Text>
                        <Text style={[cs.stayDur, { fontSize: durSize }]}>
                          {durationLabel(stay.start_ts, stay.end_ts)}
                        </Text>
                      </View>
                      {photo && (
                        <Image
                          source={{ uri: photo.uri }}
                          style={[cs.stayThumb, { width: thumbSize, height: thumbSize }]}
                          resizeMode="cover"
                        />
                      )}
                    </View>
                  </View>
                </View>
              </React.Fragment>
            );
          })}

          {overflowCount > 0 && (
            <View style={cs.overflowRow}>
              <View style={cs.tlTimeCol} />
              <View style={cs.tlDotCol}>
                <View style={cs.overflowDots}>
                  <View style={cs.overflowDot} />
                  <View style={cs.overflowDot} />
                  <View style={cs.overflowDot} />
                </View>
              </View>
              <View style={cs.stayContent}>
                <Text style={cs.overflowText}>
                  ほか {overflowCount} 箇所
                </Text>
              </View>
            </View>
          )}
        </View>

        {/* Footer branding */}
        <View style={cs.footer}>
          <View style={cs.footerLine} />
          <View style={cs.brandRow}>
            <Ionicons name="footsteps" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={cs.brandText}>TraceNote</Text>
          </View>
        </View>

        <View style={{ height: SAFE_BOTTOM }} />
      </View>
    );
  },
);

const cs = StyleSheet.create({
  card: {
    width: W,
    height: H,
    backgroundColor: "#0f172a",
    borderRadius: 16,
    overflow: "hidden",
  },
  bg: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "#0f172a",
  },
  dateSection: {
    paddingHorizontal: 24,
    marginBottom: 14,
  },
  dateEn: {
    fontSize: 11,
    fontWeight: "700",
    letterSpacing: 2,
    color: "rgba(255,255,255,0.4)",
    textTransform: "uppercase",
  },
  dateJp: {
    fontSize: 20,
    fontWeight: "800",
    color: "#ffffff",
    marginTop: 3,
  },
  statsBar: {
    flexDirection: "row",
    marginHorizontal: 24,
    backgroundColor: "rgba(255,255,255,0.06)",
    borderRadius: 10,
    paddingVertical: 10,
    marginBottom: 14,
  },
  statBox: {
    flex: 1,
    alignItems: "center",
  },
  statNum: {
    fontSize: 16,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: "#ffffff",
  },
  statUnit: {
    fontSize: 9,
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
  statDiv: {
    width: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
  },
  timeline: {
    flex: 1,
    paddingHorizontal: 24,
  },
  stayRow: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  tlTimeCol: {
    width: 40,
    alignItems: "flex-end",
    paddingRight: 8,
  },
  tlTime: {
    fontSize: 10,
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    color: "rgba(255,255,255,0.45)",
  },
  tlDotCol: {
    width: 26,
    alignItems: "center",
  },
  dot: {
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  dotLine: {
    width: 2,
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    minHeight: 8,
  },
  stayContent: {
    flex: 1,
    paddingLeft: 10,
  },
  stayHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  stayInfo: {
    flex: 1,
  },
  stayName: {
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 2,
  },
  stayDur: {
    color: "rgba(255,255,255,0.4)",
    marginTop: 1,
  },
  stayThumb: {
    borderRadius: 8,
    marginLeft: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  moveRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  moveDotLine: {
    width: 2,
    height: 14,
    backgroundColor: "rgba(255,255,255,0.06)",
  },
  moveContent: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingLeft: 10,
  },
  moveText: {
    fontSize: 9,
    color: "rgba(255,255,255,0.3)",
  },
  overflowRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 2,
  },
  overflowDots: {
    alignItems: "center",
    gap: 3,
    paddingVertical: 4,
  },
  overflowDot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: "rgba(255,255,255,0.25)",
  },
  overflowText: {
    fontSize: 11,
    color: "rgba(255,255,255,0.4)",
    paddingLeft: 10,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 4,
  },
  footerLine: {
    height: 1,
    backgroundColor: "rgba(255,255,255,0.06)",
    marginBottom: 10,
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
  },
  brandText: {
    fontSize: 12,
    fontWeight: "700",
    letterSpacing: 1,
    color: "rgba(255,255,255,0.5)",
  },
});
