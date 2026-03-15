import { Ionicons } from "@expo/vector-icons";
import React from "react";
import { Image, StyleSheet, Text, View } from "react-native";

import type { Stay, StayPhoto } from "@/core/domain/models";
import { ACTIVITY_LABELS, type Activity } from "@/core/engine/activityInference";
import type { HomeLocation } from "@/core/engine/homeDetector";
import { isHomeStay } from "@/core/engine/homeDetector";
import { CATEGORY_LABELS, type PlaceCategory } from "@/core/places/categories";

/* ─── Layout ─── */

const SCALE = 0.3;
const W = 1080 * SCALE;
const H = 1920 * SCALE;

const SAFE_TOP = H * 0.14;
const SAFE_BOTTOM = H * 0.06;

const STAYS_PER_FIRST_PAGE = 7;
const STAYS_PER_NEXT_PAGE = 10;

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
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
}

function fmtDist(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

/** Resolve place name for ShareCard. Home stays always show "自宅". */
function sharePlaceName(stay: Stay, home: HomeLocation | null): string {
  if (isHomeStay(stay, home)) return "自宅";
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

/* ─── Page splitting (all stays, no home exclusion) ─── */

export type PageSlice = {
  pageIdx: number;
  totalPages: number;
  staysSlice: Stay[];
  isFirst: boolean;
  hasNextPage: boolean;
  hasPrevPage: boolean;
  prevPageLastStay: Stay | null;
};

export function splitIntoPages(stays: Stay[]): PageSlice[] {
  if (stays.length === 0) return [];

  const pages: PageSlice[] = [];
  let offset = 0;
  let pageIdx = 0;

  const firstCount = Math.min(STAYS_PER_FIRST_PAGE, stays.length);
  pages.push({
    pageIdx, totalPages: 0,
    staysSlice: stays.slice(0, firstCount),
    isFirst: true,
    hasNextPage: false,
    hasPrevPage: false,
    prevPageLastStay: null,
  });
  offset = firstCount;
  pageIdx++;

  while (offset < stays.length) {
    const count = Math.min(STAYS_PER_NEXT_PAGE, stays.length - offset);
    pages.push({
      pageIdx, totalPages: 0,
      staysSlice: stays.slice(offset, offset + count),
      isFirst: false,
      hasNextPage: false,
      hasPrevPage: true,
      prevPageLastStay: stays[offset - 1],
    });
    offset += count;
    pageIdx++;
  }

  for (let i = 0; i < pages.length; i++) {
    pages[i].totalPages = pages.length;
    pages[i].hasNextPage = i < pages.length - 1;
  }
  return pages;
}

/* ─── ShareCardPage ─── */

export type ShareCardPageProps = {
  date: Date;
  page: PageSlice;
  photoMap: Record<number, StayPhoto[]>;
  home: HomeLocation | null;
  totalStays: number;
  totalDistanceM: number;
  totalPhotos: number;
};

export const ShareCardPage = React.forwardRef<View, ShareCardPageProps>(
  ({ date, page, photoMap, home, totalStays, totalDistanceM, totalPhotos }, ref) => {
    const { staysSlice, isFirst, pageIdx, totalPages, hasNextPage, hasPrevPage } = page;
    const multiPage = totalPages > 1;

    return (
      <View ref={ref} style={s.card} collapsable={false}>
        <View style={s.bg} />
        <View style={{ height: SAFE_TOP }} />

        {/* Date */}
        <View style={s.dateSection}>
          <View style={s.dateRow}>
            <View>
              <Text style={s.dateEn}>{formatDateEn(date)}</Text>
              <Text style={s.dateJp}>{formatDateJp(date)}</Text>
            </View>
            {multiPage && (
              <View style={s.pageBadge}>
                <Text style={s.pageText}>{pageIdx + 1}/{totalPages}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Stats (first page only) */}
        {isFirst && (
          <View style={s.statsBar}>
            <View style={s.statBox}>
              <Text style={s.statNum}>{totalStays}</Text>
              <Text style={s.statUnit}>滞在</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.statBox}>
              <Text style={s.statNum}>{fmtDist(totalDistanceM)}</Text>
              <Text style={s.statUnit}>移動距離</Text>
            </View>
            <View style={s.statDiv} />
            <View style={s.statBox}>
              <Text style={s.statNum}>{totalPhotos}</Text>
              <Text style={s.statUnit}>写真</Text>
            </View>
          </View>
        )}

        {/* Timeline */}
        <View style={s.timeline}>
          {hasPrevPage && (
            <View style={s.stayRow}>
              <View style={s.tlTimeCol} />
              <View style={s.tlDotCol}>
                <View style={s.continueLine} />
              </View>
              <View style={s.stayContent} />
            </View>
          )}
          {staysSlice.map((stay, idx) => {
            const name = sharePlaceName(stay, home);
            const icon = ACT_ICON[stay.activity ?? ""] ?? "location";
            const photo = stayPhoto(stay, photoMap);
            const isLast = idx === staysSlice.length - 1;
            const showLine = !isLast || hasNextPage;

            return (
              <View key={stay.id} style={s.stayRow}>
                <View style={s.tlTimeCol}>
                  <Text style={s.tlTime}>{fmtTime(stay.start_ts)}</Text>
                </View>
                <View style={s.tlDotCol}>
                  <View style={[s.dot, isHomeStay(stay, home) && s.dotHome]}>
                    <Ionicons name={icon as any} size={14} color="#ffffff" />
                  </View>
                  {showLine && <View style={s.dotLine} />}
                </View>
                <View style={s.stayContent}>
                  <View style={s.stayHeader}>
                    <View style={s.stayInfo}>
                      <Text style={s.stayName} numberOfLines={1}>{name}</Text>
                      <Text style={s.stayDur}>{fmtDuration(stay.start_ts, stay.end_ts)}</Text>
                    </View>
                    {photo && !isHomeStay(stay, home) && (
                      <Image
                        source={{ uri: photo.uri }}
                        style={s.stayThumb}
                        resizeMode="cover"
                      />
                    )}
                  </View>
                </View>
              </View>
            );
          })}
        </View>

        {/* Footer */}
        <View style={s.footer}>
          <View style={s.footerLine} />
          <View style={s.brandRow}>
            <Ionicons name="footsteps" size={16} color="rgba(255,255,255,0.5)" />
            <Text style={s.brandText}>TraceNote</Text>
          </View>
        </View>

        <View style={{ height: SAFE_BOTTOM }} />
      </View>
    );
  },
);

/* ─── Styles ─── */

const s = StyleSheet.create({
  card: { width: W, height: H, backgroundColor: "#0f172a", borderRadius: 16, overflow: "hidden" },
  bg: { ...StyleSheet.absoluteFillObject, backgroundColor: "#0f172a" },
  dateSection: { paddingHorizontal: 24, marginBottom: 14 },
  dateRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  dateEn: { fontSize: 11, fontWeight: "700", letterSpacing: 2, color: "rgba(255,255,255,0.4)", textTransform: "uppercase" },
  dateJp: { fontSize: 20, fontWeight: "800", color: "#ffffff", marginTop: 3 },
  pageBadge: { backgroundColor: "rgba(255,255,255,0.1)", borderRadius: 10, paddingHorizontal: 10, paddingVertical: 4, marginTop: 4 },
  pageText: { fontSize: 11, fontWeight: "700", fontVariant: ["tabular-nums"], color: "rgba(255,255,255,0.5)" },
  statsBar: { flexDirection: "row", marginHorizontal: 24, backgroundColor: "rgba(255,255,255,0.06)", borderRadius: 10, paddingVertical: 10, marginBottom: 14 },
  statBox: { flex: 1, alignItems: "center" },
  statNum: { fontSize: 16, fontWeight: "700", fontVariant: ["tabular-nums"], color: "#ffffff" },
  statUnit: { fontSize: 9, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  statDiv: { width: 1, backgroundColor: "rgba(255,255,255,0.1)" },
  timeline: { flex: 1, paddingHorizontal: 24, overflow: "hidden", marginBottom: 6 },
  stayRow: { flexDirection: "row", alignItems: "flex-start" },
  tlTimeCol: { width: 40, alignItems: "flex-end", paddingRight: 8 },
  tlTime: { fontSize: 10, fontVariant: ["tabular-nums"], fontWeight: "600", color: "rgba(255,255,255,0.45)", marginTop: 5 },
  tlDotCol: { width: 26, alignItems: "center" },
  dot: { width: 26, height: 26, borderRadius: 13, backgroundColor: "#3b82f6", justifyContent: "center", alignItems: "center" },
  dotHome: { backgroundColor: "#475569" },
  dotLine: { width: 2, flex: 1, backgroundColor: "rgba(255,255,255,0.1)", minHeight: 10 },
  continueLine: { width: 2, height: 16, backgroundColor: "rgba(255,255,255,0.1)" },
  stayContent: { flex: 1, paddingLeft: 10, paddingBottom: 6 },
  stayHeader: { flexDirection: "row", alignItems: "center" },
  stayInfo: { flex: 1 },
  stayName: { fontSize: 14, fontWeight: "700", color: "#ffffff", marginTop: 2 },
  stayDur: { fontSize: 10, color: "rgba(255,255,255,0.4)", marginTop: 2 },
  stayThumb: { width: 36, height: 36, borderRadius: 8, marginLeft: 8, backgroundColor: "rgba(255,255,255,0.08)" },
  footer: { paddingHorizontal: 24, paddingBottom: 4 },
  footerLine: { height: 1, backgroundColor: "rgba(255,255,255,0.06)", marginBottom: 10 },
  brandRow: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 5 },
  brandText: { fontSize: 12, fontWeight: "700", letterSpacing: 1, color: "rgba(255,255,255,0.5)" },
});
