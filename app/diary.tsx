import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Stay, StayPhoto } from "@/core/domain/models";
import { getStaysByDay } from "@/core/storage/stayRepo";
import { getPhotosByStayId } from "@/core/storage/stayPhotoRepo";
import { ACTIVITY_LABELS, type Activity } from "@/core/engine/activityInference";
import { CATEGORY_LABELS, type PlaceCategory } from "@/core/places/categories";

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

function durationLabel(startTs: number, endTs: number): string {
  const mins = Math.round((endTs - startTs) / 60_000);
  if (mins < 60) return `${mins}分`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? `${h}時間${m}分` : `${h}時間`;
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
  return `滞在地点`;
}

const ACTIVITY_ICON: Record<string, string> = {
  home: "home-outline",
  meal: "restaurant-outline",
  workout: "barbell-outline",
  work: "briefcase-outline",
  commute: "train-outline",
  rest: "cafe-outline",
  shopping: "bag-outline",
  outing: "walk-outline",
  other: "location-outline",
};

type StayWithPhotos = Stay & { photos: StayPhoto[] };

export default function DiaryScreen() {
  const { dayKey } = useLocalSearchParams<{ dayKey: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [staysWithPhotos, setStaysWithPhotos] = useState<StayWithPhotos[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!dayKey) return;
    setLoading(true);

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

  if (loading) {
    return (
      <View style={styles.container}>
        <Text style={styles.loadingText}>読み込み中...</Text>
      </View>
    );
  }

  const totalDurationMin = staysWithPhotos.reduce(
    (sum, s) => sum + (s.end_ts - s.start_ts) / 60_000,
    0,
  );
  const totalPhotos = staysWithPhotos.reduce((sum, s) => sum + s.photos.length, 0);
  const totalHours = Math.floor(totalDurationMin / 60);
  const totalMins = Math.round(totalDurationMin % 60);

  return (
    <>
      <Stack.Screen
        options={{
          title: dayKey ? formatDate(dayKey) : "サマリー",
          headerBackTitle: "戻る",
        }}
      />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        {staysWithPhotos.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
            <Text style={styles.emptyText}>この日の滞在データはありません</Text>
          </View>
        ) : (
          <>
            {/* Stats Header */}
            <View style={styles.statsCard}>
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{staysWithPhotos.length}</Text>
                <Text style={styles.statLabel}>滞在</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>
                  {totalHours > 0 ? `${totalHours}h${totalMins > 0 ? totalMins : ""}` : `${totalMins}m`}
                </Text>
                <Text style={styles.statLabel}>合計時間</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statItem}>
                <Text style={styles.statValue}>{totalPhotos}</Text>
                <Text style={styles.statLabel}>写真</Text>
              </View>
            </View>

            {/* Timeline */}
            {staysWithPhotos.map((stay, index) => {
              const icon = ACTIVITY_ICON[stay.activity ?? ""] ?? "location-outline";
              const placeName = resolvePlaceName(stay);
              const actLabel = stay.activity
                ? (ACTIVITY_LABELS[stay.activity as Activity] ?? stay.activity)
                : null;

              return (
                <View key={stay.id}>
                  {/* Move indicator between stays */}
                  {index > 0 && (
                    <View style={styles.moveIndicator}>
                      <View style={styles.moveLine} />
                      <Ionicons name="walk-outline" size={14} color="#94a3b8" />
                      <View style={styles.moveLine} />
                    </View>
                  )}

                  <Pressable
                    style={styles.stayItem}
                    onPress={() => router.push({ pathname: "/edit-stay", params: { id: String(stay.id) } })}
                  >
                    <View style={styles.stayHeader}>
                      <View style={styles.stayIconWrap}>
                        <Ionicons name={icon as any} size={18} color="#3b82f6" />
                      </View>
                      <View style={styles.stayInfo}>
                        <Text style={styles.stayPlace} numberOfLines={1}>{placeName}</Text>
                        <View style={styles.stayMeta}>
                          <Text style={styles.stayTime}>
                            {formatTime(stay.start_ts)} 〜 {formatTime(stay.end_ts)}
                          </Text>
                          <Text style={styles.stayDuration}>
                            {durationLabel(stay.start_ts, stay.end_ts)}
                          </Text>
                        </View>
                        {actLabel && (
                          <Text style={styles.activityChip}>{actLabel}</Text>
                        )}
                      </View>
                      {stay.needs_review && (
                        <View style={styles.reviewBadge}>
                          <Text style={styles.reviewText}>要確認</Text>
                        </View>
                      )}
                    </View>

                    {/* Photos */}
                    {stay.photos.length > 0 && (
                      <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        style={styles.photoScroll}
                        contentContainerStyle={styles.photoScrollContent}
                      >
                        {stay.photos.map((p) => (
                          p.uri && !p.uri.startsWith("ph://") ? (
                            <Image key={p.id} source={{ uri: p.uri }} style={styles.photo} />
                          ) : (
                            <View key={p.id} style={[styles.photo, styles.photoFallback]}>
                              <Ionicons name="image-outline" size={24} color="#94a3b8" />
                            </View>
                          )
                        ))}
                      </ScrollView>
                    )}
                  </Pressable>
                </View>
              );
            })}

            {/* Actions */}
            <Pressable
              style={styles.shareBtn}
              onPress={() => router.push({ pathname: "/share", params: { dayKey } })}
            >
              <Ionicons name="share-outline" size={18} color="#ffffff" />
              <Text style={styles.shareBtnText}>シェアする</Text>
            </Pressable>
          </>
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
  emptyState: {
    alignItems: "center",
    paddingTop: 80,
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#94a3b8",
  },
  statsCard: {
    flexDirection: "row",
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
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
    fontSize: 22,
    fontWeight: "700",
    color: "#0f172a",
    fontVariant: ["tabular-nums"],
  },
  statLabel: {
    fontSize: 12,
    color: "#94a3b8",
    marginTop: 2,
  },
  statDivider: {
    width: 1,
    backgroundColor: "#e2e8f0",
  },
  moveIndicator: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 6,
    gap: 8,
  },
  moveLine: {
    flex: 1,
    height: 1,
    backgroundColor: "#e2e8f0",
  },
  stayItem: {
    backgroundColor: "#ffffff",
    borderRadius: 12,
    padding: 14,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  stayHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
  },
  stayIconWrap: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: "#eff6ff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  stayInfo: {
    flex: 1,
  },
  stayPlace: {
    fontSize: 16,
    fontWeight: "600",
    color: "#0f172a",
  },
  stayMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 3,
  },
  stayTime: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    color: "#64748b",
  },
  stayDuration: {
    fontSize: 12,
    color: "#94a3b8",
  },
  activityChip: {
    fontSize: 12,
    fontWeight: "500",
    color: "#3b82f6",
    backgroundColor: "#eff6ff",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
    overflow: "hidden",
    alignSelf: "flex-start",
    marginTop: 4,
  },
  reviewBadge: {
    backgroundColor: "#fef3c7",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
  },
  reviewText: {
    fontSize: 11,
    fontWeight: "600",
    color: "#d97706",
  },
  photoScroll: {
    marginTop: 10,
  },
  photoScrollContent: {
    gap: 8,
  },
  photo: {
    width: 80,
    height: 80,
    borderRadius: 8,
    backgroundColor: "#f1f5f9",
  },
  photoFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    gap: 8,
    marginTop: 20,
  },
  shareBtnText: {
    fontSize: 15,
    fontWeight: "600",
    color: "#ffffff",
  },
});
