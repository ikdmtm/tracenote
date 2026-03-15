import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "@react-navigation/native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import { useTranslation } from "react-i18next";
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
import type { PlaceCategory } from "@/core/places/categories";

const SCREEN_WIDTH = Dimensions.get("window").width;

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function formatDate(ts: number, weekdays: string[]): string {
  const d = new Date(ts);
  return `${d.getMonth() + 1}/${d.getDate()}（${weekdays[d.getDay()]}）`;
}

function durationLabel(startTs: number, endTs: number, t: (key: string, opts?: Record<string, number>) => string): string {
  const mins = Math.round((endTs - startTs) / 60_000);
  if (mins < 60) return t("format.minutes", { m: mins });
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? t("format.hoursMinutes", { h, m }) : t("format.hours", { h });
}

function resolvePlaceName(
  stay: Stay,
  fallback: string,
  categoryT: (key: string) => string,
): string {
  if (stay.user_place_name) return stay.user_place_name;
  if (stay.place_json) {
    try {
      const parsed = JSON.parse(stay.place_json);
      if (parsed.top?.name) return parsed.top.name;
      if (parsed.top?.category && parsed.top.category !== "other") {
        return categoryT(`category.${parsed.top.category}`) || parsed.top.category;
      }
    } catch {}
  }
  return fallback;
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
  const { t } = useTranslation();
  const { theme: themeColors } = useTheme();
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
      <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
        <Text style={[styles.loadingText, { color: themeColors.textMuted }]}>{t("stayDetail.loading")}</Text>
      </View>
    );
  }

  const weekdays = t("calendar.weekdays", { returnObjects: true }) as string[];
  const placeName = resolvePlaceName(stay, t("stayDetail.stayAt"), (k) => t(k));
  const actLabel = stay.activity ? (t(`activity.${stay.activity}`) || stay.activity) : null;
  const icon = ACTIVITY_ICON[stay.activity ?? ""] ?? "location-outline";

  return (
    <>
      <Stack.Screen
        options={{
          title: placeName,
          headerBackTitle: t("stayDetail.back"),
          headerRight: () => (
            <Pressable
              onPress={() => router.push({ pathname: "/edit-stay", params: { id: String(stay.id) } })}
              hitSlop={8}
            >
              <Ionicons name="create-outline" size={22} color={themeColors.primary} />
            </Pressable>
          ),
        }}
      />
      <ScrollView
        style={[styles.container, { backgroundColor: themeColors.bg }]}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Header Card */}
        <View style={[styles.headerCard, { backgroundColor: themeColors.surface }]}>
          <View style={styles.headerTop}>
            <View style={[styles.iconCircle, { backgroundColor: themeColors.primaryLight }]}>
              <Ionicons name={icon as any} size={24} color={themeColors.primary} />
            </View>
            <View style={styles.headerInfo}>
              <Text style={[styles.placeName, { color: themeColors.text }]}>{placeName}</Text>
              {actLabel && (
                <Text style={[styles.activityLabel, { color: themeColors.primary }]}>{actLabel}</Text>
              )}
            </View>
            {stay.needs_review && (
              <View style={[styles.reviewBadge, { backgroundColor: themeColors.divider }]}>
                <Text style={[styles.reviewText, { color: themeColors.warning }]}>{t("stayDetail.needsReview")}</Text>
              </View>
            )}
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="time-outline" size={16} color={themeColors.textSecondary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                {formatTime(stay.start_ts)} 〜 {formatTime(stay.end_ts)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="hourglass-outline" size={16} color={themeColors.textSecondary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                {durationLabel(stay.start_ts, stay.end_ts, t)}
              </Text>
            </View>
          </View>

          <View style={styles.metaRow}>
            <View style={styles.metaItem}>
              <Ionicons name="calendar-outline" size={16} color={themeColors.textSecondary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
                {formatDate(stay.start_ts, weekdays)}
              </Text>
            </View>
            <View style={styles.metaItem}>
              <Ionicons name="navigate-outline" size={16} color={themeColors.textSecondary} />
              <Text style={[styles.metaText, { color: themeColors.textSecondary }]}>
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
                      ? themeColors.success
                      : stay.confidence >= 0.4
                        ? themeColors.warning
                        : themeColors.danger,
                },
              ]}
            />
            <Text style={[styles.confText, { color: themeColors.textMuted }]}>
              {t("stayDetail.accuracy", { value: Math.round(stay.confidence * 100) })}
            </Text>
          </View>
        </View>

        {/* Memo Section */}
        {stay.memo && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{t("stayDetail.memo")}</Text>
            <Text style={[styles.memoText, { color: themeColors.textSecondary }]}>{stay.memo}</Text>
          </View>
        )}

        {/* Photos Section */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: themeColors.text }]}>{t("stayDetail.photos", { count: photos.length })}</Text>
          {photos.length > 0 ? (
            <View style={styles.photoGrid}>
              {photos.map((p) => (
                <Pressable key={p.id} onPress={() => setViewerPhoto(p)} style={styles.photoCell}>
                  {p.uri && !p.uri.startsWith("ph://") ? (
                    <Image source={{ uri: p.uri }} style={styles.photoThumb} />
                  ) : (
                    <View style={[styles.photoThumb, styles.photoFallback, { backgroundColor: themeColors.divider }]}>
                      <Ionicons name="image-outline" size={24} color={themeColors.textMuted} />
                    </View>
                  )}
                  <Text style={[styles.photoTime, { color: themeColors.textMuted }]}>{formatTime(p.taken_at)}</Text>
                </Pressable>
              ))}
            </View>
          ) : (
            <Text style={[styles.emptyPhotos, { color: themeColors.textMuted }]}>
              {t("stayDetail.noPhotos")}
            </Text>
          )}
        </View>

        {/* Edit Button */}
        <Pressable
          style={[
            styles.editBtn,
            { borderColor: themeColors.primaryBorder, backgroundColor: themeColors.primaryLight },
          ]}
          onPress={() => router.push({ pathname: "/edit-stay", params: { id: String(stay.id) } })}
        >
          <Ionicons name="create-outline" size={18} color={themeColors.primary} />
          <Text style={[styles.editBtnText, { color: themeColors.primary }]}>{t("stayDetail.edit")}</Text>
        </Pressable>
      </ScrollView>

      <PhotoViewer photo={viewerPhoto} onClose={() => setViewerPhoto(null)} theme={themeColors} />
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
  memoText: {
    fontSize: 14,
    lineHeight: 20,
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
