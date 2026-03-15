import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Stay, StayPhoto, MovementRow } from "@/core/domain/models";
import { getRawEventCount } from "@/core/storage/rawEventRepo";
import { getStaysByDay } from "@/core/storage/stayRepo";
import { getPhotosByStayId } from "@/core/storage/stayPhotoRepo";
import { getMovementsByDay, updateMovementUserMode, upsertMovements } from "@/core/storage/movementRepo";
import {
  startBackgroundLocation,
} from "@/core/location/backgroundTask";
import {
  useLocationPermission,
  type PermissionState,
} from "@/features/location/useLocationPermission";
import { StayCard } from "@/features/stays/StayCard";
import {
  estimateMovements,
  MOVEMENT_ICONS,
  MOVEMENT_LABELS,
  type Movement,
  type MovementMode,
} from "@/core/engine/movementEstimator";
import { CalendarPicker } from "@/features/ui/CalendarPicker";
import { MovementModePicker } from "@/features/movements/MovementModePicker";

function StatusBadge({ status }: { status: PermissionState }) {
  const config: Record<PermissionState, { label: string; color: string; bg: string }> = {
    always: { label: "常に許可", color: "#16a34a", bg: "#dcfce7" },
    foreground: { label: "使用中のみ", color: "#d97706", bg: "#fef3c7" },
    denied: { label: "拒否", color: "#dc2626", bg: "#fee2e2" },
    undetermined: { label: "未設定", color: "#64748b", bg: "#f1f5f9" },
  };
  const c = config[status];
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <View style={[styles.badgeDot, { backgroundColor: c.color }]} />
      <Text style={[styles.badgeText, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

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

function formatDuration(mins: number): string {
  if (mins < 60) return `${mins}分`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}h${m}m` : `${h}h`;
}

function formatDistance(meters: number): string {
  if (meters < 1000) return `${meters}m`;
  return `${(meters / 1000).toFixed(1)}km`;
}

type DisplayMovement = Movement & { dbId?: number; userMode?: string | null };

type ListItem =
  | { type: "stay"; stay: Stay; photos: StayPhoto[] }
  | { type: "movement"; movement: DisplayMovement };

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { status, loading, requestAlways, openSettings } = useLocationPermission();
  const [eventCount, setEventCount] = useState(0);
  const [currentDate, setCurrentDate] = useState(new Date());
  const [stays, setStays] = useState<Stay[]>([]);
  const [photoMap, setPhotoMap] = useState<Record<number, StayPhoto[]>>({});
  const [dbMovements, setDbMovements] = useState<MovementRow[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [bgStarted, setBgStarted] = useState(false);
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [editingMovement, setEditingMovement] = useState<DisplayMovement | null>(null);

  const isTodayView = isToday(currentDate);

  const refreshData = useCallback(async (date: Date) => {
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
    const dayEnd = dayStart + 24 * 60 * 60_000;

    const [s, count, mvRows] = await Promise.all([
      getStaysByDay(db, dayStart, dayEnd),
      isToday(date) ? getRawEventCount(db) : Promise.resolve(0),
      getMovementsByDay(db, dayStart, dayEnd),
    ]);
    setStays(s);
    setEventCount(count);
    setDbMovements(mvRows);

    const pMap: Record<number, StayPhoto[]> = {};
    for (const st of s) {
      const photos = await getPhotosByStayId(db, st.id);
      if (photos.length > 0) pMap[st.id] = photos;
    }
    setPhotoMap(pMap);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refreshData(currentDate);
    }, [refreshData, currentDate]),
  );

  useEffect(() => {
    if (!isTodayView) return;
    const interval = setInterval(() => refreshData(currentDate), 30_000);
    return () => clearInterval(interval);
  }, [refreshData, currentDate, isTodayView]);

  useEffect(() => {
    if (status === "always" && !bgStarted) {
      startBackgroundLocation()
        .then((ok) => setBgStarted(ok))
        .catch(() => setBgStarted(false));
    }
  }, [status, bgStarted]);

  const handlePermissionPress = useCallback(async () => {
    try {
      if (status === "undetermined" || status === "foreground") {
        const result = await requestAlways();
        if (result === "always") {
          await startBackgroundLocation().then((ok) => setBgStarted(ok));
        }
      } else if (status === "denied") {
        openSettings();
      }
    } catch (e) {
      console.warn("[Home] Permission/BG start error:", e);
    }
  }, [status, requestAlways, openSettings]);

  const goToPrevDay = useCallback(() => {
    setCurrentDate((d) => addDays(d, -1));
  }, []);

  const goToNextDay = useCallback(() => {
    setCurrentDate((d) => isToday(d) ? d : addDays(d, 1));
  }, []);

  const goToToday = useCallback(() => {
    setCurrentDate(new Date());
  }, []);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData(currentDate);
    setRefreshing(false);
  }, [refreshData, currentDate]);

  const movementMap = useMemo(() => {
    const dbMap: Record<number, MovementRow> = {};
    for (const m of dbMovements) dbMap[m.to_stay_id] = m;

    const computed = estimateMovements(stays);
    const map: Record<number, DisplayMovement> = {};
    for (const c of computed) {
      const dbRow = dbMap[c.to_stay_id];
      if (dbRow) {
        const effectiveMode = (dbRow.user_mode ?? dbRow.mode) as MovementMode;
        map[c.to_stay_id] = {
          ...c,
          mode: effectiveMode,
          dbId: dbRow.id,
          userMode: dbRow.user_mode,
        };
      } else {
        map[c.to_stay_id] = c;
      }
    }
    return map;
  }, [stays, dbMovements]);

  const movements = useMemo(() => Object.values(movementMap), [movementMap]);

  const listItems: ListItem[] = useMemo(() => {
    const items: ListItem[] = [];
    for (const stay of stays) {
      const m = movementMap[stay.id];
      if (m) items.push({ type: "movement", movement: m });
      items.push({ type: "stay", stay, photos: photoMap[stay.id] ?? [] });
    }
    return items;
  }, [stays, photoMap, movementMap]);

  const totalDistanceM = movements.reduce((s, m) => s + m.distance_m, 0);
  const totalPhotos = Object.values(photoMap).reduce((s, arr) => s + arr.length, 0);

  const handleMovementModeChange = useCallback(async (mode: MovementMode) => {
    if (!editingMovement) return;
    if (editingMovement.dbId) {
      await updateMovementUserMode(db, editingMovement.dbId, mode);
    } else {
      await upsertMovements(db, [{
        from_stay_id: editingMovement.from_stay_id,
        to_stay_id: editingMovement.to_stay_id,
        start_ts: editingMovement.start_ts,
        end_ts: editingMovement.end_ts,
        distance_m: editingMovement.distance_m,
        duration_min: editingMovement.duration_min,
        avg_speed_kmh: editingMovement.avg_speed_kmh,
        mode: editingMovement.mode,
      }]);
      const dayStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60_000;
      const rows = await getMovementsByDay(db, dayStart, dayEnd);
      const row = rows.find(
        (r) => r.from_stay_id === editingMovement.from_stay_id && r.to_stay_id === editingMovement.to_stay_id,
      );
      if (row) await updateMovementUserMode(db, row.id, mode);
    }
    await refreshData(currentDate);
    setEditingMovement(null);
  }, [db, editingMovement, refreshData, currentDate]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "movement") {
      const m = item.movement;
      const effectiveMode = m.mode as MovementMode;
      const icon = MOVEMENT_ICONS[effectiveMode];
      const label = MOVEMENT_LABELS[effectiveMode];
      const isEdited = !!m.userMode;
      return (
        <Pressable style={styles.movementRow} onPress={() => setEditingMovement(m)}>
          <View style={styles.movementLine} />
          <View style={[styles.movementBubble, isEdited && styles.movementBubbleEdited]}>
            <Ionicons name={icon as any} size={14} color={isEdited ? "#3b82f6" : "#64748b"} />
            <Text style={[styles.movementText, isEdited && styles.movementTextEdited]}>
              {label} {formatDuration(m.duration_min)} · {formatDistance(m.distance_m)}
            </Text>
            <Ionicons name="pencil-outline" size={10} color={isEdited ? "#3b82f6" : "#94a3b8"} />
          </View>
          <View style={styles.movementLine} />
        </Pressable>
      );
    }
    return <StayCard stay={item.stay} photos={item.photos.length > 0 ? item.photos : undefined} />;
  };

  const keyExtractor = (item: ListItem, index: number) => {
    if (item.type === "movement") return `m-${item.movement.from_stay_id}-${item.movement.to_stay_id}`;
    return `s-${item.stay.id}`;
  };

  const needsPermission = status !== "always" && isTodayView;

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>TraceNote</Text>
        {isTodayView && status === "always" && (
          <View style={styles.statusMini}>
            <StatusBadge status={status} />
            <Text style={styles.eventCountMini}>{eventCount}件</Text>
          </View>
        )}
      </View>

      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <Pressable onPress={goToPrevDay} style={styles.navBtn} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color="#3b82f6" />
        </Pressable>
        <Pressable onPress={() => setCalendarOpen(true)} style={styles.dateCenter}>
          <Text style={styles.dateText}>{formatDisplayDate(currentDate)}</Text>
          {isTodayView && <Text style={styles.todayBadge}>今日</Text>}
        </Pressable>
        <Pressable
          onPress={goToNextDay}
          style={[styles.navBtn, isTodayView && { opacity: 0.3 }]}
          disabled={isTodayView}
          hitSlop={8}
        >
          <Ionicons name="chevron-forward" size={20} color="#3b82f6" />
        </Pressable>
      </View>
      <CalendarPicker
        visible={calendarOpen}
        selectedDate={currentDate}
        onSelect={setCurrentDate}
        onClose={() => setCalendarOpen(false)}
      />
      <MovementModePicker
        visible={!!editingMovement}
        currentMode={(editingMovement?.mode ?? "unknown") as MovementMode}
        onSelect={handleMovementModeChange}
        onClose={() => setEditingMovement(null)}
      />

      {/* Permission CTA - only when needed on today view */}
      {needsPermission && (
        <View style={styles.permCard}>
          <Pressable style={styles.permButton} onPress={handlePermissionPress}>
            <Ionicons name="location" size={18} color="#ffffff" />
            <Text style={styles.permButtonText}>
              {status === "denied" ? "設定で許可する" : "位置情報を常に許可する"}
            </Text>
          </Pressable>
        </View>
      )}

      {/* Stats Header */}
      {stays.length > 0 && (
        <View style={styles.statsRow}>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{stays.length}</Text>
            <Text style={styles.statLabel}>滞在</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{formatDistance(totalDistanceM)}</Text>
            <Text style={styles.statLabel}>移動距離</Text>
          </View>
          <View style={styles.statDivider} />
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{totalPhotos}</Text>
            <Text style={styles.statLabel}>写真</Text>
          </View>
        </View>
      )}

      {/* Main Content */}
      {stays.length > 0 ? (
        <FlatList
          data={listItems}
          keyExtractor={keyExtractor}
          renderItem={renderItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          ListFooterComponent={
            <Pressable
              style={styles.shareBtn}
              onPress={() => router.push({ pathname: "/share", params: { dayKey: dayKeyFromDate(currentDate) } })}
            >
              <Ionicons name="share-outline" size={16} color="#3b82f6" />
              <Text style={styles.shareBtnText}>シェアする</Text>
            </Pressable>
          }
        />
      ) : (
        <View style={styles.placeholder}>
          {isTodayView && status === "always" ? (
            <Text style={styles.placeholderText}>
              バックグラウンドで位置情報を収集中...{"\n"}
              滞在が検出されるとここに表示されます
            </Text>
          ) : isTodayView ? (
            <Text style={styles.placeholderText}>
              位置情報を「常に許可」すると{"\n"}
              行動ログの自動記録が始まります
            </Text>
          ) : (
            <>
              <Ionicons name="calendar-outline" size={40} color="#cbd5e1" />
              <Text style={styles.placeholderText}>この日の滞在データはありません</Text>
            </>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  title: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
  },
  statusMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  eventCountMini: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    color: "#64748b",
  },
  dateNav: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  navBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  dateCenter: {
    alignItems: "center",
  },
  dateText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  todayBadge: {
    fontSize: 11,
    fontWeight: "600",
    color: "#3b82f6",
    marginTop: 1,
  },
  loadingText: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 100,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  badgeDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    marginRight: 5,
  },
  badgeText: {
    fontSize: 11,
    fontWeight: "600",
  },
  permCard: {
    marginHorizontal: 16,
    marginBottom: 8,
  },
  permButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  permButtonText: {
    fontSize: 14,
    fontWeight: "600",
    color: "#ffffff",
  },
  statsRow: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    marginHorizontal: 16,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  statItem: {
    flex: 1,
    alignItems: "center",
  },
  statValue: {
    fontSize: 17,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
    color: "#0f172a",
  },
  statLabel: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 1,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#e2e8f0",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingTop: 4,
    paddingBottom: 24,
  },
  movementRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 4,
    gap: 8,
  },
  movementLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  movementBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#f8fafc",
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  movementText: {
    fontSize: 11,
    color: "#64748b",
  },
  movementBubbleEdited: {
    borderColor: "#bfdbfe",
    backgroundColor: "#eff6ff",
  },
  movementTextEdited: {
    color: "#3b82f6",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#dbeafe",
    backgroundColor: "#eff6ff",
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
    marginTop: 12,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#3b82f6",
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 8,
  },
  placeholderText: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 24,
  },
});
