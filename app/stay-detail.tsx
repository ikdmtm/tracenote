import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  Dimensions,
  Image,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { Stay, StayPhoto } from "@/core/domain/models";
import { getStayById } from "@/core/storage/stayRepo";
import { getPhotosByStayId } from "@/core/storage/stayPhotoRepo";
import { useTheme } from "@/features/theme/ThemeContext";
import type { ThemeColors } from "@/features/theme/colors";
import { ACTIVITY_LABELS, type Activity } from "@/core/engine/activityInference";
import { CATEGORY_LABELS, type PlaceCategory } from "@/core/places/categories";

const SCREEN_WIDTH = Dimensions.get("window").width;

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDate(ts: number): string {
  const d = new Date(ts);
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`;
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

function PhotoViewer({
  photo,
  onClose,
  theme: t,
}: {
  photo: StayPhoto | null;
  onClose: () => void;
  theme: ThemeColors;
}) {
  if (!photo) return null;
  const ratio = photo.width > 0 && photo.height > 0 ? photo.height / photo.width : 1;
  const displayHeight = Math.min(SCREEN_WIDTH * ratio, Dimensions.get("window").height * 0.7);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.viewerOverlay} onPress={onClose}>
        <View style={styles.viewerContent}>
          {photo.uri && !photo.uri.startsWith("ph://") ? (
            <Image
              source={{ uri: photo.uri }}
              style={{ width: SCREEN_WIDTH - 32, height: displayHeight, borderRadius: 12 }}
              resizeMode="contain"
            />
          ) : (
            <View
              style={[
                styles.viewerFallback,
                { width: SCREEN_WIDTH - 32, height: 200, backgroundColor: t.surface },
              ]}
            >
              <Ionicons name="image-outline" size={48} color={t.textMuted} />
            </View>
          )}
          <Text style={[styles.viewerTime, { color: t.textOnPrimary }]}>{formatTime(photo.taken_at)}</Text>
        </View>
      </Pressable>
    </Modal>
  );
}

export default function StayDetailScreen() {
  const { theme: t } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [stay, setStay] = useState<Stay | null>(null);
  const [photos, setPhotos] = useState<StayPhoto[]>([]);
  const [viewerPhoto, setViewerPhoto] = useState<StayPhoto | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    const s = await getStayById(db, Number(id));
    setStay(s);
    if (s) {
      const p = await getPhotosByStayId(db, s.id);
      setPhotos(p);
    }
    setLoading(false);
  }, [db, id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  if (loading || !stay) {
    return (
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <Text style={[styles.loadingText, { color: t.textMuted }]}>読み込み中...</Text>
      </View>
    );
  }

  const placeName = resolvePlaceName(stay);
  const actLabel = stay.activity ? (ACTIVITY_LABELS[stay.activity as Activity] ?? stay.activity) : null;
  const icon = ACTIVITY_ICON[stay.activity ?? ""] ?? "location-outline";

  return (
    <>
      <Stack.Screen
        options={{
          title: placeName,
          headerBackTitle: "戻る",
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: "/edit-stay", params: { id: String(stay.id) } })}
              hitSlop={8}
            >
              <Ionicons name="create-outline" size={22} color={t.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: t.bg }]}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Card */}
        <View style={[styles.headerCard, { backgroundColor: t.surface }]}>
          <View style={styles.headerTop}>
            <View style={[styles.iconCircle, { backgroundColor: t.primaryLight }]}>
              <Ionicons name={icon as any} size={24} color={t.primary} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.placeName, { color: t.text }]}>{placeName}</Text>
              {actLabel && (
                <Text style={[styles.activityLabel, { color: t.primary }]}>{actLabel}</Text>
              )}
            </View>
            {stay.needs_review && (
              <View style={[styles.reviewBadge, { backgroundColor: t.divider }]}>
                <Text style={[styles.reviewText, { color: t.warning }]}>要確認</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={t.textSecondary} />
              <Text style={[styles.metaText, { color: t.textSecondary }]}>
                {formatTime(stay.start_ts)} 〜 {formatTime(stay.end_ts)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="hourglass-outline" size={16} color={t.textSecondary} />
              <Text style={[styles.metaText, { color: t.textSecondary }]}>
                {durationLabel(stay.start_ts, stay.end_ts)}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color={t.textSecondary} />
              <Text style={[styles.metaText, { color: t.textSecondary }]}>
                {formatDate(stay.start_ts)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="navigate-outline" size={16} color={t.textSecondary} />
              <Text style={[styles.metaText, { color: t.textSecondary }]}>
                {stay.lat.toFixed(4)}, {stay.lng.toFixed(4)}
              </Text>
            </View>
          </View>

          <View style={styles.confRow}>
            <View
              style={[
                styles.confDot,
                {
                  backgroundColor:
                    stay.confidence >= 0.7
                      ? t.success
                      : stay.confidence >= 0.4
                        ? t.warning
                        : t.danger,
                },
              ]}
            />
            <Text style={[styles.confText, { color: t.textMuted }]}>
              精度 {Math.round(stay.confidence * 100)}%
            </Text>
          </View>
        </View>

        {/* Photos Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: t.text }]}>写真（{photos.length}枚）</Text>
          {photos.length > 0 ? (
            <View style={styles.photoGrid}>
              {photos.map((p) => (
                <Pressable key={p.id} onPress={() => setViewerPhoto(p)} style={styles.photoCell}>
                  {p.uri && !p.uri.startsWith("ph://") ? (
                    <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                  ) : (
                    <View style={[styles.photoThumb, styles.photoFallback, { backgroundColor: t.divider }]}>
                      <Ionicons name="image-outline" size={24} color={t.textMuted} />
                    </View>
                  )}
                  <Text style={[styles.photoTime, { color: t.textMuted }]}>{formatTime(p.taken_at)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyPhotos, { color: t.textMuted }]}>
              紐づいている写真はありません
            </Text>
          )}
        </View>

        {/* Edit Button */}
        <Pressable
          style={[
            styles.editBtn,
            { borderColor: t.primaryBorder, backgroundColor: t.primaryLight },
          ]}
          onPress={() => router.push({ pathname: "/edit-stay", params: { id: String(stay.id) } })}
        >
          <Ionicons name="create-outline" size={18} color={t.primary} />
          <Text style={[styles.editBtnText, { color: t.primary }]}>この滞在を編集</Text>
        </Pressable>
      </ScrollView>

      <PhotoViewer photo={viewerPhoto} onClose={() => setViewerPhoto(null)} theme={t} />
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
  },
  loadingText: {
    textAlign: "center",
    marginTop: 80,
    fontSize: 15,
  },
  headerCard: {
    borderRadius: 14,
    padding: 16,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  headerTop: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 14,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  headerInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 20,
    fontWeight: "700",
  },
  activityLabel: {
    fontSize: 13,
    fontWeight: "500",
    marginTop: 2,
  },
  reviewBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 8,
  },
  reviewText: {
    fontSize: 12,
    fontWeight: "600",
  },
  metaRow: {
    flexDirection: "row",
    gap: 16,
    marginBottom: 8,
  },
  metaItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  metaText: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  confRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    marginTop: 4,
  },
  confDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  confText: {
    fontSize: 12,
  },
  section: {
    marginTop: 20,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "600",
    marginBottom: 10,
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoCell: {
    width: (SCREEN_WIDTH - 32 - 16) / 3,
  },
  photoThumb: {
    width: "100%",
    aspectRatio: 1,
    borderRadius: 10,
  },
  photoFallback: {
    justifyContent: "center",
    alignItems: "center",
  },
  photoTime: {
    fontSize: 11,
    fontVariant: ["tabular-nums"],
    textAlign: "center",
    marginTop: 3,
  },
  emptyPhotos: {
    fontSize: 14,
    textAlign: "center",
    paddingVertical: 20,
  },
  editBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 20,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 14,
  },
  editBtnText: {
    fontSize: 15,
    fontWeight: "500",
  },
  viewerOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.85)",
    justifyContent: "center",
    alignItems: "center",
  },
  viewerContent: {
    alignItems: "center",
  },
  viewerFallback: {
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  viewerTime: {
    fontSize: 14,
    fontVariant: ["tabular-nums"],
    marginTop: 12,
  },
});
