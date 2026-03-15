import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { DiaryEntry, Stay, StayPhoto } from "@/core/domain/models";
import { getDiaryByDay } from "@/core/storage/diaryRepo";
import { getStaysByDay } from "@/core/storage/stayRepo";
import { getPhotosByStayId } from "@/core/storage/stayPhotoRepo";
import { generateDiary } from "@/core/diary/diaryService";
import { ACTIVITY_LABELS, type Activity } from "@/core/engine/activityInference";

function formatDate(dayKey: string): string {
  const [y, m, d] = dayKey.split("-");
  const date = new Date(Number(y), Number(m) - 1, Number(d));
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${Number(m)}月${Number(d)}日（${weekdays[date.getDay()]}）`;
}

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

type StayWithPhotos = Stay & { photos: StayPhoto[] };

export default function DiaryScreen() {
  const { dayKey } = useLocalSearchParams<{ dayKey: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [diary, setDiary] = useState<DiaryEntry | null>(null);
  const [staysWithPhotos, setStaysWithPhotos] = useState<StayWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);
  const [regenerating, setRegenerating] = useState(false);

  const load = useCallback(async () => {
    if (!dayKey) return;
    setLoading(true);

    const entry = await getDiaryByDay(db, dayKey);
    setDiary(entry);

    const [y, m, d] = dayKey.split("-").map(Number);
    const dayStart = new Date(y, m - 1, d).getTime();
    const dayEnd = dayStart + 24 * 60 * 60_000;
    const stays = await getStaysByDay(db, dayStart, dayEnd);

    const withPhotos: StayWithPhotos[] = [];
    for (const stay of stays) {
      const photos = await getPhotosByStayId(db, stay.id);
      withPhotos.push({ ...stay, photos });
    }
    setStaysWithPhotos(withPhotos);
    setLoading(false);
  }, [db, dayKey]);

  useEffect(() => {
    load();
  }, [load]);

  const handleRegenerate = useCallback(async () => {
    if (!dayKey) return;
    setRegenerating(true);
    try {
      const [y, m, d] = dayKey.split("-").map(Number);
      const dayStart = new Date(y, m - 1, d).getTime();
      const dayEnd = dayStart + 24 * 60 * 60_000;
      const entry = await generateDiary(db, dayStart, dayEnd);
      if (entry) setDiary(entry);
    } catch (e) {
      Alert.alert("エラー", `再生成に失敗: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRegenerating(false);
    }
  }, [db, dayKey]);

  const highlights: string[] = diary?.highlights_json
    ? (() => { try { return JSON.parse(diary.highlights_json); } catch { return []; } })()
    : [];

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  return (
    <>
      <Stack.Screen
        options={{
          title: dayKey ? formatDate(dayKey) : "日記",
          headerBackTitle: "戻る",
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {diary ? (
          <>
            {/* Title */}
            <Text style={styles.diaryTitle}>{diary.title}</Text>

            {/* Highlights */}
            {highlights.length > 0 && (
              <View style={styles.highlightsCard}>
                <Text style={styles.highlightsLabel}>ハイライト</Text>
                {highlights.map((h, i) => (
                  <View key={i} style={styles.highlightRow}>
                    <Ionicons name="star" size={14} color="#f59e0b" />
                    <Text style={styles.highlightText}>{h}</Text>
                  </View>
                ))}
              </View>
            )}

            {/* Body */}
            <View style={styles.bodyCard}>
              <Text style={styles.bodyText}>{diary.body}</Text>
            </View>

            {/* Stay Photos */}
            {staysWithPhotos.some((s) => s.photos.length > 0) && (
              <View style={styles.photosSection}>
                <Text style={styles.photosSectionTitle}>今日の写真</Text>
                {staysWithPhotos
                  .filter((s) => s.photos.length > 0)
                  .map((stay) => (
                    <View key={stay.id} style={styles.stayPhotoGroup}>
                      <Text style={styles.stayPhotoLabel}>
                        {formatTime(stay.start_ts)} {stay.user_place_name ?? (ACTIVITY_LABELS[stay.activity as Activity] ?? "滞在")}
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.photoScroll}>
                        {stay.photos.map((p) => (
                          <Image key={p.id} source={{ uri: p.uri }} style={styles.photo} />
                        ))}
                      </ScrollView>
                    </View>
                  ))}
              </View>
            )}

            {/* Actions */}
            <View style={styles.actions}>
              <Pressable
                style={styles.shareBtn}
                onPress={() => router.push({ pathname: "/share", params: { dayKey } })}
              >
                <Ionicons name="share-outline" size={18} color="#ffffff" />
                <Text style={styles.shareBtnText}>シェアする</Text>
              </Pressable>

              <Pressable
                style={[styles.regenBtn, regenerating && styles.regenBtnDisabled]}
                onPress={handleRegenerate}
                disabled={regenerating}
              >
                <Ionicons name="refresh" size={16} color="#8b5cf6" />
                <Text style={styles.regenBtnText}>
                  {regenerating ? "再生成中..." : "再生成"}
                </Text>
              </Pressable>
            </View>
          </>
        ) : (
          <View style={styles.emptyState}>
            <Ionicons name="book-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>
              この日の日記はまだありません
            </Text>
            <Pressable
              style={[styles.generateBtn, regenerating && styles.regenBtnDisabled]}
              onPress={handleRegenerate}
              disabled={regenerating}
            >
              <Ionicons name="sparkles" size={18} color="#ffffff" />
              <Text style={styles.generateBtnText}>
                {regenerating ? "生成中..." : "日記を生成"}
              </Text>
            </Pressable>
          </View>
        )}
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingText: {
    textAlign: "center",
    marginTop: 80,
    fontSize: 15,
    color: "#94a3b8",
  },
  diaryTitle: {
    fontSize: 24,
    fontWeight: "700",
    color: "#0f172a",
    marginBottom: 16,
    lineHeight: 32,
  },
  highlightsCard: {
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#fef3c7",
  },
  highlightsLabel: {
    fontSize: 12,
    fontWeight: "700",
    color: "#d97706",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  highlightRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginBottom: 4,
  },
  highlightText: {
    flex: 1,
    fontSize: 14,
    color: "#92400e",
    lineHeight: 20,
  },
  bodyCard: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 20,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
    marginBottom: 16,
  },
  bodyText: {
    fontSize: 15,
    color: "#334155",
    lineHeight: 26,
  },
  photosSection: {
    marginBottom: 16,
  },
  photosSectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 10,
  },
  stayPhotoGroup: {
    marginBottom: 12,
  },
  stayPhotoLabel: {
    fontSize: 13,
    fontWeight: "500",
    color: "#64748b",
    marginBottom: 6,
  },
  photoScroll: {
    flexDirection: "row",
  },
  photo: {
    width: 100,
    height: 100,
    borderRadius: 8,
    marginRight: 8,
    backgroundColor: "#f1f5f9",
  },
  actions: {
    gap: 10,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
  regenBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#f5f3ff",
    borderRadius: 12,
    paddingVertical: 12,
    gap: 6,
    borderWidth: 1,
    borderColor: "#ede9fe",
  },
  regenBtnDisabled: {
    opacity: 0.6,
  },
  regenBtnText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#8b5cf6",
  },
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#94a3b8",
    marginBottom: 8,
  },
  generateBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#8b5cf6",
    borderRadius: 12,
    paddingVertical: 14,
    paddingHorizontal: 24,
    gap: 8,
  },
  generateBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
});
