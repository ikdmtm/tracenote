import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { RawEvent, Stay } from "@/core/domain/models";
import { getRawEventsByDay } from "@/core/storage/rawEventRepo";
import { AdBanner } from "@/features/monetization/AdBanner";
import { getStaysByDay } from "@/core/storage/stayRepo";
import { getCategoryLabel, type PlaceCategory } from "@/core/places/categories";
import { CalendarPicker } from "@/features/ui/CalendarPicker";
import { useTheme } from "@/features/theme/ThemeContext";

function dayKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(d: Date, weekdays: string[]): string {
  return `${d.getMonth() + 1}月${d.getDate()}日（${weekdays[d.getDay()]}）`;
}

function isToday(d: Date): boolean {
  const now = new Date();
  return d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatCoord(n: number): string {
  return n.toFixed(4);
}

function resolveStayName(stay: Stay, fallback: string): string {
  if (stay.user_place_name) return stay.user_place_name;
  if (stay.place_json) {
    try {
      const parsed = JSON.parse(stay.place_json);
      if (parsed.top?.name) return parsed.top.name;
      if (parsed.top?.category && parsed.top.category !== "other") {
        return getCategoryLabel(parsed.top.category as PlaceCategory);
      }
    } catch {}
  }
  return fallback;
}

type AnnotatedEvent = RawEvent & {
  stayName: string | null;
  isMoving: boolean;
};

function annotateEvents(events: RawEvent[], stays: Stay[], stayFallback: string): AnnotatedEvent[] {
  return events.map((ev) => {
    const matchedStay = stays.find(
      (s) => ev.ts >= s.start_ts && ev.ts <= s.end_ts,
    );
    if (matchedStay) {
      return { ...ev, stayName: resolveStayName(matchedStay, stayFallback), isMoving: false };
    }
    return { ...ev, stayName: null, isMoving: true };
  });
}

function hourLabel(ts: number): string {
  return `${String(new Date(ts).getHours()).padStart(2, "0")}:00`;
}

export default function TimelineScreen() {
  const db = useSQLiteContext();
  const { t: tKey, i18n } = useTranslation();
  const { theme: t } = useTheme();
  const weekdays = tKey("calendar.weekdays", { returnObjects: true }) as string[];
  const [currentDate, setCurrentDate] = useState(new Date());
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [stays, setStays] = useState<Stay[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);

  const loadData = useCallback(async (date: Date) => {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60_000;

    const [ev, st] = await Promise.all([
      getRawEventsByDay(db, dayStart, dayEnd),
      getStaysByDay(db, dayStart, dayEnd),
    ]);
    setEvents(ev);
    setStays(st);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData(currentDate);
    }, [loadData, currentDate]),
  );

  const goToPrevDay = useCallback(() => {
    setCurrentDate((d) => addDays(d, -1));
  }, []);

  const goToNextDay = useCallback(() => {
    setCurrentDate((d) => isToday(d) ? d : addDays(d, 1));
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(currentDate);
    setRefreshing(false);
  }, [loadData, currentDate]);

  const annotated = useMemo(
    () => annotateEvents(events, stays, tKey("stayCard.stayAt")),
    [events, stays, tKey, i18n.language],
  );

  const isTodayView = isToday(currentDate);

  const renderEvent = ({ item, index }: { item: AnnotatedEvent; index: number }) => {
    const showHourHeader = index === 0 ||
      new Date(annotated[index - 1].ts).getHours() !== new Date(item.ts).getHours();

    return (
      <>
        {showHourHeader && (
          <View style={styles.hourHeader}>
            <Text style={[styles.hourText, { color: t.textSecondary }]}>{hourLabel(item.ts)}</Text>
            <View style={[styles.hourLine, { backgroundColor: t.surfaceBorder }]} />
          </View>
        )}
        <View style={[styles.eventRow, item.isMoving && styles.eventRowMoving]}>
          <Text style={[styles.eventTime, { color: t.textSecondary }]}>{formatTime(item.ts)}</Text>
          <View style={[styles.eventDot, { backgroundColor: item.isMoving ? t.warning : t.primary }]} />
          <View style={styles.eventInfo}>
            {item.stayName ? (
              <Text style={[styles.eventPlace, { color: t.text }]} numberOfLines={1}>{item.stayName}</Text>
            ) : (
              <Text style={[styles.eventMoving, { color: t.warning }]}>{tKey("timeline.moving")}</Text>
            )}
            <Text style={[styles.eventCoord, { color: t.textMuted }]}>
              {formatCoord(item.lat)}, {formatCoord(item.lng)}
            </Text>
          </View>
          {item.acc > 0 && (
            <Text style={[styles.eventAcc, { color: t.textMuted }, item.acc > 100 && { color: t.warning }]}>
              ±{Math.round(item.acc)}m
            </Text>
          )}
        </View>
      </>
    );
  };

  return (
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      <View style={[styles.dateNav, { backgroundColor: t.surface, borderBottomColor: t.surfaceBorder }]}>
        <Pressable onPress={goToPrevDay} style={[styles.navBtn, { backgroundColor: t.divider }]} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={t.primary} />
        </Pressable>
        <Pressable onPress={() => setCalendarOpen(true)} style={styles.dateCenter}>
          <Text style={[styles.dateText, { color: t.text }]}>{formatDisplayDate(currentDate, weekdays)}</Text>
          {isTodayView && <Text style={[styles.todayBadge, { color: t.primary }]}>{tKey("timeline.today")}</Text>}
        </Pressable>
        <Pressable
          onPress={goToNextDay}
          style={[styles.navBtn, { backgroundColor: t.divider }, isTodayView && { opacity: 0.3 }]}
          disabled={isTodayView}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={20} color={t.primary} />
        </Pressable>
      </View>
      <CalendarPicker
        visible={calendarOpen}
        selectedDate={currentDate}
        onSelect={setCurrentDate}
        onClose={() => setCalendarOpen(false)}
      />

      <View style={[styles.summaryBar, { backgroundColor: t.surface, borderBottomColor: t.surfaceBorder }]}>
        <Text style={[styles.summaryText, { color: t.textMuted }]}>
          {tKey("timeline.summary", { events: events.length, stays: stays.length })}
        </Text>
      </View>

      {events.length === 0 ? (
        <View style={styles.placeholder}>
          <Ionicons name="pulse-outline" size={40} color={t.textMuted} />
          <Text style={[styles.placeholderText, { color: t.textMuted }]}>{tKey("timeline.emptyNoData")}</Text>
        </View>
      ) : (
        <FlatList
          data={annotated}
          keyExtractor={(item) => String(item.id)}
          renderItem={renderEvent}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}

      <AdBanner />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
  },
  dateCenter: {
    alignItems: "center",
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
  },
  todayBadge: {
    fontSize: 11,
    fontWeight: "600",
    marginTop: 1,
  },
  summaryBar: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  summaryText: {
    fontSize: 12,
  },
  listContent: {
    paddingVertical: 4,
  },
  hourHeader: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  hourText: {
    fontSize: 13,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  hourLine: {
    flex: 1,
    height: 1,
  },
  eventRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  eventRowMoving: {
    opacity: 0.7,
  },
  eventTime: {
    width: 42,
    fontSize: 12,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  eventDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginHorizontal: 8,
  },
  eventInfo: {
    flex: 1,
  },
  eventPlace: {
    fontSize: 14,
    fontWeight: "500",
  },
  eventMoving: {
    fontSize: 14,
    fontWeight: "500",
  },
  eventCoord: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    marginTop: 1,
  },
  eventAcc: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  placeholderText: {
    fontSize: 15,
    textAlign: "center",
    lineHeight: 24,
  },
});
