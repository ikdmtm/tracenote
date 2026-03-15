import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import type { Stay, StayPhoto } from "@/core/domain/models";
import { ACTIVITY_LABELS, type Activity } from "@/core/engine/activityInference";
import type { HomeLocation } from "@/core/engine/homeDetector";
import { isHomeStay } from "@/core/engine/homeDetector";
import { distanceM } from "@/core/engine/geo";
import {
  MOVEMENT_LABELS,
  MOVEMENT_ICONS,
  type MovementMode,
} from "@/core/engine/movementEstimator";
import { CATEGORY_LABELS, type PlaceCategory } from "@/core/places/categories";

/* ─── Layout constants ─── */

const SCALE = 0.3;
const W = 1080 * SCALE;
const H = 1920 * SCALE;

const SAFE_TOP = H * 0.14;
const SAFE_BOTTOM = H * 0.14;

const STAYS_PER_FIRST_PAGE = 5;
const STAYS_PER_NEXT_PAGE = 7;

/* ─── Helpers ─── */

function formatDateEn(d: Date): string {
  const wd = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const mo = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${wd[d.getDay()]}, ${mo[d.getMonth()]} ${d.getDate()}`;
}

function formatDateJp(d: Date): string {
  const wd = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${wd[d.getDay()]}）`;
}

function fmtTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function fmtDuration(startTs: number, endTs: number): string {
  const mins = Math.round((endTs - startTs) / 60_000);
  if (mins < 60) return `${mins}分`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function fmtDist(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

function classifySpeed(kmh: number): MovementMode {
  if (kmh <= 0) return "unknown";
  if (kmh <= 6) return "walk";
  if (kmh <= 25) return "bicycle";
  if (kmh <= 300) return "vehicle";
  return "unknown";
}

function placeName(stay: Stay): string {
  if (stay.user_place_name) return stay.user_place_name;
  if (stay.place_json) {
    try {
      const p = JSON.parse(stay.place_json);
      if (p.top?.name) return p.top.name;
      if (p.top?.category && p.top.category !== "other")
        return CATEGORY_LABELS[p.top.category as PlaceCategory] ?? p.top.category;
    } catch {}
  }
  if (stay.activity) return ACTIVITY_LABELS[stay.activity as Activity] ?? "滞在";
  return "滞在";
}

const ACT_ICON: Record<string, string> = {
  home: "home", meal: "restaurant", workout: "barbell", work: "briefcase",
  commute: "train", rest: "cafe", shopping: "bag", outing: "walk", other: "location",
};

function stayPhoto(stay: Stay, photoMap: Record<number, StayPhoto[]>): StayPhoto | null {
  const list = photoMap[stay.id];
  if (!list?.length) return null;
  return list.find((p) => p.uri && !p.uri.startsWith("ph://")) ?? null;
}

/* ─── Movement between two consecutive visible stays ─── */

type MoveInfo = { mode: MovementMode; dist: number; dur: number };

/**
 * Calculate movement info between two visible (non-home) stays.
 * If home stays exist between them, subtract the home stay durations
 * to get the actual travel time for speed estimation.
 */
function calcMoveWithHomeGap(
  from: Stay,
  to: Stay,
  allStays: Stay[],
  home: HomeLocation | null,
): MoveInfo {
  const dist = Math.round(distanceM(from.lat, from.lng, to.lat, to.lng));
  const totalGapMs = to.start_ts - from.end_ts;

  let homeTimeMs = 0;
  if (home) {
    for (const s of allStays) {
      if (s.start_ts >= from.end_ts && s.end_ts <= to.start_ts && isHomeStay(s, home)) {
        homeTimeMs += s.end_ts - s.start_ts;
      }
    }
  }

  const travelMs = Math.max(60_000, totalGapMs - homeTimeMs);
  const travelMin = Math.round(travelMs / 60_000);
  const travelH = travelMs / 3_600_000;
  const speed = travelH > 0 ? (dist / 1000) / travelH : 0;

  return { mode: classifySpeed(speed), dist, dur: travelMin };
}

/* ─── Page splitting ─── */

export type ShareCardData = {
  date: Date;
  stays: Stay[];
  photoMap: Record<number, StayPhoto[]>;
  home: HomeLocation | null;
};

export type PageSlice = {
  pageIdx: number;
  totalPages: number;
  staysSlice: Stay[];
  isFirst: boolean;
  prevPageLastStay: Stay | null;
};

export function splitIntoPages(
  stays: Stay[],
  home: HomeLocation | null,
): { visibleStays: Stay[]; pages: PageSlice[] } {
  const visible = stays.filter((s) => !isHomeStay(s, home));
  if (visible.length === 0) return { visibleStays: visible, pages: [] };

  const pages: PageSlice[] = [];
  let offset = 0;
  let pageIdx = 0;

  const firstCount = Math.min(STAYS_PER_FIRST_PAGE, visible.length);
  pages.push({
    pageIdx, totalPages: 0,
    staysSlice: visible.slice(0, firstCount),
    isFirst: true,
    prevPageLastStay: null,
  });
  offset = firstCount;
  pageIdx++;

  while (offset < visible.length) {
    const count = Math.min(STAYS_PER_NEXT_PAGE, visible.length - offset);
    pages.push({
      pageIdx, totalPages: 0,
      staysSlice: visible.slice(offset, offset + count),
      isFirst: false,
      prevPageLastStay: visible[offset - 1],
    });
    offset += count;
    pageIdx++;
  }

  for (const p of pages) p.totalPages = pages.length;
  return { visibleStays: visible, pages };
}

/* ─── ShareCard (single page) ─── */

export type ShareCardPageProps = {
  date: Date;
  page: PageSlice;
  photoMap: Record<number, StayPhoto[]>;
  allStays: Stay[];
  home: HomeLocation | null;
  totalStays: number;
  totalDistanceM: number;
  totalPhotos: number;
};

export const ShareCardPage = React.forwardRef<View, ShareCardPageProps>(
  ({ date, page, photoMap, allStays, home, totalStays, totalDistanceM, totalPhotos }, ref) => {
    const { staysSlice, isFirst, pageIdx, totalPages, prevPageLastStay } = page;
    const multiPage = totalPages > 1;

    return (
      <View ref={ref} style={st.card} collapsable={false}>
        <View style={st.bg} />
        <View style={{ height: SAFE_TOP }} />

        {/* Date header */}
        <View style={st.dateSection}>
          <View style={st.dateRow}>
            <View style={st.dateInfo}>
              <Text style={st.dateEn}>{formatDateEn(date)}</Text>
              <Text style={st.dateJp}>{formatDateJp(date)}</Text>
            </View>
            {multiPage && (
              <View style={st.pageBadge}>
                <Text style={st.pageText}>{pageIdx + 1}/{totalPages}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats (first page only) */}
        {isFirst && (
          <View style={st.statsBar}>
            <View style={st.statBox}>
              <Text style={st.statNum}>{totalStays}</Text>
              <Text style={st.statUnit}>お出かけ</Text>
            </View>
            <View style={st.statDiv} />
            <View style={st.statBox}>
              <Text style={st.statNum}>{fmtDist(totalDistanceM)}</Text>
              <Text style={st.statUnit}>移動距離</Text>
            </View>
            <View style={st.statDiv} />
            <View style={st.statBox}>
              <Text style={st.statNum}>{totalPhotos}</Text>
              <Text style={st.statUnit}>写真</Text>
            </View>
          </View>
        )}

        {/* Timeline */}
        <View style={st.timeline}>
          {staysSlice.map((stay, idx) => {
            const name = placeName(stay);
            const icon = ACT_ICON[stay.activity ?? ""] ?? "location";
            const photo = stayPhoto(stay, photoMap);
            const isLast = idx === staysSlice.length - 1;

            const prevStay = idx > 0 ? staysSlice[idx - 1] : prevPageLastStay;
            const move = prevStay ? calcMoveWithHomeGap(prevStay, stay, allStays, home) : null;

            return (
              <React.Fragment key={stay.id}>
                {move && (
                  <View style={st.moveRow}>
                    <View style={st.tlTimeCol} />
                    <View style={st.tlDotCol}>
                      <View style={st.moveLine} />
                    </View>
                    <View style={st.moveContent}>
                      <Ionicons
                        name={MOVEMENT_ICONS[move.mode] as any}
                        size={10}
                        color="rgba(255,255,255,0.35)"
                      />
                      <Text style={st.moveText}>
                        {MOVEMENT_LABELS[move.mode]} {fmtDist(move.dist)}
                      </Text>
                    </View>
                  </View>
                )}

                <View style={st.stayRow}>
                  <View style={st.tlTimeCol}>
                    <Text style={st.tlTime}>{fmtTime(stay.start_ts)}</Text>
                  </View>
                  <View style={st.tlDotCol}>
                    <View style={st.dot}>
                      <Ionicons name={icon as any} size={14} color="#ffffff" />
                    </View>
                    {!isLast && <View style={st.dotLine} />}
                  </View>
                  <View style={st.stayContent}>
                    <View style={st.stayHeader}>
                      <View style={st.stayInfo}>
                        <Text style={st.stayName} numberOfLines={1}>{name}</Text>
                        <Text style={st.stayDur}>{fmtDuration(stay.start_ts, stay.end_ts)}</Text>
                      </View>
                      {photo && (
                        <Image
                          source={{ uri: photo.uri }}
                          style={st.stayThumb}
                          resizeMode="cover"
                        />
                      )}
                    </View>
                  </View>
                </View>
              </React.Fragment>
            );
          })}
        </View>

        {/* Footer */}
        <View style={st.footer}>
          <View style={st.footerLine} />
          <View style={st.brandRow}>
            <Ionicons name="footsteps" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={st.brandText}>TraceNote</Text>
          </View>
        </View>

        <View style={{ height: SAFE_BOTTOM }} />
      </View>
    );
  },
);

/* ─── Styles ─── */

const st = StyleSheet.create({
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
  dateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
  },
  dateInfo: {},
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
  pageBadge: {
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 4,
    marginTop: 4,
  },
  pageText: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: "rgba(255,255,255,0.5)",
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
    marginTop: 5,
  },
  tlDotCol: {
    width: 26,
    alignItems: "center",
  },
  dot: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: "#3b82f6",
    justifyContent: "center",
    alignItems: "center",
  },
  dotLine: {
    width: 2,
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.1)",
    minHeight: 10,
  },
  stayContent: {
    flex: 1,
    paddingLeft: 10,
    paddingBottom: 6,
  },
  stayHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  stayInfo: {
    flex: 1,
  },
  stayName: {
    fontSize: 14,
    fontWeight: "700",
    color: "#ffffff",
    marginTop: 2,
  },
  stayDur: {
    fontSize: 10,
    color: "rgba(255,255,255,0.4)",
    marginTop: 2,
  },
  stayThumb: {
    width: 36,
    height: 36,
    borderRadius: 8,
    marginLeft: 8,
    backgroundColor: "rgba(255,255,255,0.08)",
  },
  moveRow: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 2,
  },
  moveLine: {
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
