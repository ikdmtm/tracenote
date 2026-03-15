import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { DiaryEntry, Stay, StayPhoto } from "@/core/domain/models";
import { getRawEventCount } from "@/core/storage/rawEventRepo";
import { getTodayStays } from "@/core/storage/stayRepo";
import { getPhotosByStayId } from "@/core/storage/stayPhotoRepo";
import { getDiaryByDay } from "@/core/storage/diaryRepo";
import { generateTodayDiary } from "@/core/diary/diaryService";
import {
  startBackgroundLocation,
} from "@/core/location/backgroundTask";
import {
  useLocationPermission,
  type PermissionState,
} from "@/features/location/useLocationPermission";
import { StayCard } from "@/features/stays/StayCard";

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

function todayDayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function HomeScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { status, loading, requestAlways, openSettings } = useLocationPermission();
  const [eventCount, setEventCount] = useState(0);
  const [stays, setStays] = useState<Stay[]>([]);
  const [photoMap, setPhotoMap] = useState<Record<number, StayPhoto[]>>({});
  const [diary, setDiary] = useState<DiaryEntry | null>(null);
  const [generating, setGenerating] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [bgStarted, setBgStarted] = useState(false);

  const refreshData = useCallback(async () => {
    const count = await getRawEventCount(db);
    setEventCount(count);
    const todayStays = await getTodayStays(db);
    setStays(todayStays);

    const pMap: Record<number, StayPhoto[]> = {};
    for (const s of todayStays) {
      const photos = await getPhotosByStayId(db, s.id);
      if (photos.length > 0) pMap[s.id] = photos;
    }
    setPhotoMap(pMap);

    const d = await getDiaryByDay(db, todayDayKey());
    setDiary(d);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      refreshData();
    }, [refreshData]),
  );

  useEffect(() => {
    const interval = setInterval(refreshData, 30_000);
    return () => clearInterval(interval);
  }, [refreshData]);

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

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    setRefreshing(false);
  }, [refreshData]);

  const handleGenerateDiary = useCallback(async () => {
    if (stays.length === 0) {
      Alert.alert("データなし", "今日の滞在データがまだありません");
      return;
    }
    setGenerating(true);
    try {
      const entry = await generateTodayDiary(db);
      if (entry) {
        setDiary(entry);
        router.push({ pathname: "/diary", params: { dayKey: todayDayKey() } });
      } else {
        Alert.alert("生成失敗", "日記を生成できませんでした");
      }
    } catch (e) {
      Alert.alert("エラー", `日記生成に失敗しました: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setGenerating(false);
    }
  }, [db, stays, router]);

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.title}>TraceNote</Text>
      <Text style={styles.subtitle}>今日のアクティビティ</Text>

      <View style={styles.statusCard}>
        <View style={styles.statusRow}>
          <Text style={styles.statusLabel}>位置情報</Text>
          <StatusBadge status={status} />
        </View>
        {status === "always" && (
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>記録イベント</Text>
            <Text style={styles.statusValue}>{eventCount}件</Text>
          </View>
        )}
        {status !== "always" && (
          <Pressable style={styles.permButton} onPress={handlePermissionPress}>
            <Ionicons name="location" size={18} color="#ffffff" />
            <Text style={styles.permButtonText}>
              {status === "denied" ? "設定で許可する" : "位置情報を常に許可する"}
            </Text>
          </Pressable>
        )}
      </View>

      {/* Diary Section */}
      {stays.length > 0 && (
        <View style={styles.diaryCard}>
          {diary ? (
            <Pressable
              style={styles.diaryExisting}
              onPress={() => router.push({ pathname: "/diary", params: { dayKey: todayDayKey() } })}
            >
              <View style={styles.diaryInfo}>
                <Ionicons name="book-outline" size={20} color="#3b82f6" />
                <View style={{ flex: 1, marginLeft: 10 }}>
                  <Text style={styles.diaryTitle} numberOfLines={1}>{diary.title ?? "今日の日記"}</Text>
                  <Text style={styles.diaryHint}>タップして読む</Text>
                </View>
              </View>
              <Ionicons name="chevron-forward" size={18} color="#94a3b8" />
            </Pressable>
          ) : (
            <Pressable
              style={[styles.generateBtn, generating && styles.generateBtnDisabled]}
              onPress={handleGenerateDiary}
              disabled={generating}
            >
              <Ionicons name="sparkles" size={18} color="#ffffff" />
              <Text style={styles.generateBtnText}>
                {generating ? "生成中..." : "今日の日記を生成"}
              </Text>
            </Pressable>
          )}
        </View>
      )}

      {stays.length > 0 ? (
        <FlatList
          data={stays}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <StayCard stay={item} photos={photoMap[item.id]} />}
          ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
          contentContainerStyle={styles.stayList}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        />
      ) : (
        <View style={styles.placeholder}>
          {status === "always" ? (
            <Text style={styles.placeholderText}>
              バックグラウンドで位置情報を収集中...{"\n"}
              滞在が検出されるとここにカードが表示されます
            </Text>
          ) : (
            <Text style={styles.placeholderText}>
              位置情報を「常に許可」すると{"\n"}
              行動ログの自動記録が始まります
            </Text>
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
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: "700",
    color: "#0f172a",
  },
  subtitle: {
    fontSize: 15,
    color: "#64748b",
    marginTop: 4,
    marginBottom: 20,
  },
  loadingText: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 100,
  },
  statusCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    marginBottom: 16,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
  },
  statusLabel: {
    fontSize: 15,
    color: "#334155",
  },
  statusValue: {
    fontSize: 15,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: "#0f172a",
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginRight: 6,
  },
  badgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  permButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#2563eb",
    borderRadius: 10,
    paddingVertical: 12,
    marginTop: 8,
    gap: 8,
  },
  permButtonText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  diaryCard: {
    marginBottom: 12,
  },
  diaryExisting: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: "#eff6ff",
    borderRadius: 12,
    padding: 14,
    borderWidth: 1,
    borderColor: "#dbeafe",
  },
  diaryInfo: {
    flexDirection: "row",
    alignItems: "center",
    flex: 1,
  },
  diaryTitle: {
    fontSize: 15,
    fontWeight: "600",
    color: "#1e40af",
  },
  diaryHint: {
    fontSize: 12,
    color: "#60a5fa",
    marginTop: 1,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8b5cf6",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  generateBtnDisabled: {
    opacity: 0.6,
  },
  generateBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  stayList: {
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
