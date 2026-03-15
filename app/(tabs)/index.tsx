import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
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
  type Movement,
  type MovementMode,
} from "@/core/engine/movementEstimator";
import { CalendarPicker } from "@/features/ui/CalendarPicker";
import { MovementModePicker } from "@/features/movements/MovementModePicker";
import { AdBanner } from "@/features/monetization/AdBanner";
import { useTheme } from "@/features/theme/ThemeContext";
import type { ThemeColors } from "@/features/theme/colors";

function StatusBadge({ status }: { status: PermissionState }) {
  const { t } = useTranslation();
  const config: Record<PermissionState, { label: string; color: string; bg: string }> = {
    always: { label: t("permission.always"), color: "#16a34a", bg: "#dcfce7" },
    foreground: { label: t("permission.whenInUse"), color: "#d97706", bg: "#fef3c7" },
    denied: { label: t("permission.denied"), color: "#dc2626", bg: "#fee2e2" },
    undetermined: { label: t("permission.undetermined"), color: "#64748b", bg: "#f1f5f9" },
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
  const { t: tKey } = useTranslation();
  const { theme: t } = useTheme();
  const weekdays = tKey("calendar.weekdays", { returnObjects: true }) as string[];
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
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <Text style={[styles.loadingText, { color: t.textMuted }]}>{tKey("home.loading")}</Text>
      </View>
    );
  }

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === "movement") {
      const m = item.movement;
      const effectiveMode = m.mode as MovementMode;
      const icon = MOVEMENT_ICONS[effectiveMode];
      const label = tKey(`movement.${effectiveMode}`);
      const isEdited = !!m.userMode;
      return (
        <Pressable style={styles.movementRow} onPress={() => setEditingMovement(m)}>
          <View style={[styles.movementLine, { backgroundColor: t.surfaceBorder }]} />
          <View style={[
            styles.movementBubble,
            { backgroundColor: t.bg, borderColor: t.surfaceBorder },
            isEdited && { borderColor: t.primaryBorder, backgroundColor: t.primaryLight },
          ]}>
            <Ionicons name={icon as any} size={14} color={isEdited ? t.primary : t.textSecondary} />
            <Text style={[
              styles.movementText,
              { color: t.textSecondary },
              isEdited && { color: t.primary },
            ]}>
              {label} {formatDuration(m.duration_min)} · {formatDistance(m.distance_m)}
            </Text>
            {isEdited && <Ionicons name="pencil-outline" size={10} color={t.primary} />}
          </View>
          <View style={[styles.movementLine, { backgroundColor: t.surfaceBorder }]} />
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
    <View style={[styles.container, { backgroundColor: t.bg }]}>
      {/* Date Navigation */}
      <View style={styles.dateNav}>
        <Pressable onPress={goToPrevDay} style={[styles.navBtn, { backgroundColor: t.divider }]} hitSlop={8}>
          <Ionicons name="chevron-back" size={20} color={t.primary} />
        </Pressable>
        <Pressable onPress={() => setCalendarOpen(true)} style={styles.dateCenter}>
          <Text style={[styles.dateText, { color: t.text }]}>{formatDisplayDate(currentDate, weekdays)}</Text>
          {isTodayView && <Text style={[styles.todayBadge, { color: t.primary }]}>{tKey("home.today")}</Text>}
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
      <MovementModePicker
        visible={!!editingMovement}
        currentMode={(editingMovement?.mode ?? "unknown") as MovementMode}
        onSelect={handleMovementModeChange}
        onClose={() => setEditingMovement(null)}
      />

      {needsPermission && (
        <View style={styles.permCard}>
          <Pressable style={[styles.permButton, { backgroundColor: t.primary }]} onPress={handlePermissionPress}>
            <Ionicons name="location" size={18} color={t.textOnPrimary} />
            <Text style={[styles.permButtonText, { color: t.textOnPrimary }]}>
              {status === "denied" ? tKey("home.permOpenSettings") : tKey("home.permAlways")}
            </Text>
          </Pressable>
        </View>
      )}

      {stays.length > 0 && (
        <View style={[styles.statsRow, { backgroundColor: t.surface }]}>
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.text }]}>{stays.length}</Text>
            <Text style={[styles.statLabel, { color: t.textMuted }]}>{tKey("home.stays")}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: t.surfaceBorder }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.text }]}>{formatDistance(totalDistanceM)}</Text>
            <Text style={[styles.statLabel, { color: t.textMuted }]}>{tKey("home.distance")}</Text>
          </View>
          <View style={[styles.statDivider, { backgroundColor: t.surfaceBorder }]} />
          <View style={styles.statItem}>
            <Text style={[styles.statValue, { color: t.text }]}>{totalPhotos}</Text>
            <Text style={[styles.statLabel, { color: t.textMuted }]}>{tKey("home.photos")}</Text>
          </View>
        </View>
      )}

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
              style={[styles.shareBtn, { borderColor: t.primaryBorder, backgroundColor: t.primaryLight }]}
              onPress={() => router.push({ pathname: "/share", params: { dayKey: dayKeyFromDate(currentDate) } })}
            >
              <Ionicons name="share-outline" size={16} color={t.primary} />
              <Text style={[styles.shareBtnText, { color: t.primary }]}>{tKey("home.share")}</Text>
            </Pressable>
          }
        />
      ) : (
        <View style={styles.placeholder}>
          {isTodayView && status === "always" ? (
            <Text style={[styles.placeholderText, { color: t.textMuted }]}>
              {tKey("home.emptyCollecting")}
            </Text>
          ) : isTodayView ? (
            <Text style={[styles.placeholderText, { color: t.textMuted }]}>
              {tKey("home.emptyNeedPerm")}
            </Text>
          ) : (
            <>
              <Ionicons name="calendar-outline" size={40} color={t.textMuted} />
              <Text style={[styles.placeholderText, { color: t.textMuted }]}>{tKey("home.emptyNoData")}</Text>
            </>
          )}
        </View>
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
  loadingText: {
    fontSize: 15,
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
    borderRadius: 10,
    paddingVertical: 12,
    gap: 8,
  },
  permButtonText: {
    fontSize: 14,
    fontWeight: "600",
  },
  statsRow: {
    flexDirection: "row",
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
  },
  statLabel: {
    fontSize: 11,
    marginTop: 1,
  },
  statDivider: {
    width: 1,
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
  },
  movementBubble: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  movementText: {
    fontSize: 11,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderRadius: 10,
    paddingVertical: 12,
    gap: 6,
    marginTop: 12,
  },
  shareBtnText: {
    fontSize: 14,
    fontWeight: "500",
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
