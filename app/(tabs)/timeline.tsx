import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Stay, StayPhoto } from "@/core/domain/models";
import { getStaysByDay } from "@/core/storage/stayRepo";
import { getPhotosByStayId } from "@/core/storage/stayPhotoRepo";
import { StayCard } from "@/features/stays/StayCard";

function dayKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDisplayDate(d: Date): string {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
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

export default function TimelineScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [stays, setStays] = useState<Stay[]>([]);
  const [photoMap, setPhotoMap] = useState<Record<number, StayPhoto[]>>({});
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async (date: Date) => {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60_000;

    const s = await getStaysByDay(db, dayStart, dayEnd);
    setStays(s);

    const pMap: Record<number, StayPhoto[]> = {};
    for (const st of s) {
      const photos = await getPhotosByStayId(db, st.id);
      if (photos.length > 0) pMap[st.id] = photos;
    }
    setPhotoMap(pMap);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData(currentDate);
    }, [loadData, currentDate]),
  );

  const goToPrevDay = useCallback(() => {
    const prev = addDays(currentDate, -1);
    setCurrentDate(prev);
  }, [currentDate]);

  const goToNextDay = useCallback(() => {
    if (isToday(currentDate)) return;
    const next = addDays(currentDate, 1);
    setCurrentDate(next);
  }, [currentDate]);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData(currentDate);
    setRefreshing(false);
  }, [loadData, currentDate]);

  const dayKey = dayKeyFromDate(currentDate);
  const isTodayView = isToday(currentDate);

  return (
    <View style={styles.container}>
      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <Pressable onPress={goToPrevDay} style={styles.navBtn}>
          <Ionicons name="chevron-back" size={22} color="#3b82f6" />
        </Pressable>
        <Pressable onPress={goToToday} style={styles.dateCenter}>
          <Text style={styles.dateText}>{formatDisplayDate(currentDate)}</Text>
          {isTodayView && <Text style={styles.todayBadge}>今日</Text>}
        </Pressable>
        <Pressable
          onPress={goToNextDay}
          style={[styles.navBtn, isTodayView && { opacity: 0.3 }]}
          disabled={isTodayView}
        >
          <Ionicons name="chevron-forward" size={22} color="#3b82f6" />
        </Pressable>
      </View>

      {/* Summary Link */}
      {stays.length > 0 && (
        <Pressable
          style={styles.summaryLink}
          onPress={() => router.push({ pathname: "/diary", params: { dayKey } })}
        >
          <Ionicons name="calendar-outline" size={18} color="#3b82f6" />
          <Text style={styles.summaryLinkText}>
            サマリーを見る（{stays.length}件の滞在）
          </Text>
          <Ionicons name="chevron-forward" size={16} color="#94a3b8" />
        </Pressable>
      )}

      {/* Stays */}
      {stays.length === 0 ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            この日の滞在データはありません
          </Text>
        </View>
      ) : (
        <FlatList
          data={stays}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => (
            <StayCard stay={item} photos={photoMap[item.id]} />
          )}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: "#ffffff",
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#e2e8f0",
  },
  navBtn: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  dateCenter: {
    alignItems: "center",
  },
  dateText: {
    fontSize: 17,
    fontWeight: "600",
    color: "#0f172a",
  },
  todayBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3b82f6",
    marginTop: 2,
  },
  summaryLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginHorizontal: 16,
    marginTop: 12,
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    padding: 12,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  summaryLinkText: {
    flex: 1,
    fontSize: 14,
    fontWeight: "500",
    color: "#1e40af",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 24,
  },
});
