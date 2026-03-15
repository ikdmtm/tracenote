import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Alert,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import type { Stay, StayPhoto } from "@/core/domain/models";
import { useTheme } from "@/features/theme/ThemeContext";
import { type Activity } from "@/core/engine/activityInference";
import type { PlaceCategory } from "@/core/places/categories";
import { getStayById, updateStay } from "@/core/storage/stayRepo";
import { getPhotosByStayId, insertStayPhoto, deleteStayPhoto } from "@/core/storage/stayPhotoRepo";
import { enrichStay } from "@/core/engine/enrichService";
import { matchPhotosForStay } from "@/core/photos/photoMatcher";
import { getSetting } from "@/core/storage/settingsRepo";

function formatTime(ts: number): string {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function durationLabel(startTs: number, endTs: number, t: (key: string, opts?: Record<string, number>) => string): string {
  const mins = Math.round((endTs - startTs) / 60_000);
  if (mins < 60) return t("format.minutes", { m: mins });
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m > 0 ? t("format.hoursMinutes", { h, m }) : t("format.hours", { h });
}

function parsePlaceJson(json: string | null): {
  name: string | null;
  category: PlaceCategory | null;
  count: number;
} {
  if (!json) return { name: null, category: null, count: 0 };
  try {
    const parsed = JSON.parse(json);
    return {
      name: parsed.top?.name ?? null,
      category: parsed.top?.category ?? null,
      count: parsed.count ?? 0,
    };
  } catch {
    return { name: null, category: null, count: 0 };
  }
}

const ACTIVITY_OPTIONS: Activity[] = [
  "home",
  "meal",
  "workout",
  "work",
  "commute",
  "rest",
  "shopping",
  "outing",
  "other",
];

export default function EditStayScreen() {
  const { t } = useTranslation();
  const { theme: themeColors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [stay, setStay] = useState<Stay | null>(null);
  const [photos, setPhotos] = useState<StayPhoto[]>([]);
  const [editName, setEditName] = useState("");
  const [memo, setMemo] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [reMatching, setReMatching] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const s = await getStayById(db, Number(id));
    if (!s) {
      Alert.alert(t("editStay.error"), t("editStay.notFound"));
      router.back();
      return;
    }
    setStay(s);
    setEditName(s.user_place_name ?? "");
    setMemo(s.memo ?? "");
    setSelectedActivity((s.activity as Activity) ?? null);
    const p = await getPhotosByStayId(db, s.id);
    setPhotos(p);
  }, [db, id, router, t]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSave = useCallback(async () => {
    if (!stay) return;
    setSaving(true);
    try {
      await updateStay(db, stay.id, {
        user_place_name: editName.trim() || null,
        activity: selectedActivity,
        memo: memo.trim() || null,
        needs_review: false,
      });
      router.back();
    } catch (e) {
      Alert.alert(t("editStay.error"), t("editStay.saveFailed"));
    } finally {
      setSaving(false);
    }
  }, [db, stay, editName, memo, selectedActivity, router, t]);

  const handleReEnrich = useCallback(async () => {
    if (!stay) return;
    setEnriching(true);
    try {
      await enrichStay(db, stay);
      await load();
    } catch (e) {
      Alert.alert(t("editStay.error"), t("editStay.reEnrichFailed"));
    } finally {
      setEnriching(false);
    }
  }, [db, stay, load, t]);

  const handleRemovePhoto = useCallback(async (photoId: number) => {
    await deleteStayPhoto(db, photoId);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }, [db]);

  const handleReMatchPhotos = useCallback(async () => {
    if (!stay) return;
    setReMatching(true);
    try {
      const exclScreenshots = (await getSetting(db, "exclude_screenshots")) !== "false";
      const matched = await matchPhotosForStay(stay, { excludeScreenshots: exclScreenshots });
      const existingAssetIds = new Set(photos.map((p) => p.asset_id));
      let added = 0;
      for (const m of matched) {
        if (!existingAssetIds.has(m.asset_id)) {
          await insertStayPhoto(db, m);
          added++;
        }
      }
      if (added > 0) {
        const p = await getPhotosByStayId(db, stay.id);
        setPhotos(p);
        Alert.alert(t("editStay.done"), t("editStay.photosAdded", { count: added }));
      } else {
        Alert.alert(t("editStay.result"), t("editStay.noNewPhotos"));
      }
    } catch (e) {
      Alert.alert(t("editStay.error"), t("editStay.reMatchFailed"));
    } finally {
      setReMatching(false);
    }
  }, [db, stay, photos, t]);

  const handleAddFromLibrary = useCallback(async () => {
    if (!stay) return;
    const { status } = await MediaLibrary.getPermissionsAsync();
    if (status !== MediaLibrary.PermissionStatus.GRANTED) {
      Alert.alert(t("editStay.photoAccessRequired"), t("editStay.photoAccessRequiredMsg"));
      return;
    }
    // Fetch recent photos and let user see what's available
    const recent = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [MediaLibrary.SortBy.creationTime],
      first: 50,
    });
    if (recent.assets.length === 0) {
      Alert.alert(t("editStay.noPhotosTitle"), t("editStay.noPhotosInLibrary"));
      return;
    }
    // For now, auto-match is the primary flow. Manual add is via re-match.
    await handleReMatchPhotos();
  }, [stay, handleReMatchPhotos, t]);

  if (!stay) {
    return (
      <View style={[styles.container, { backgroundColor: themeColors.bg }]}>
        <Text style={[styles.loadingText, { color: themeColors.textMuted }]}>{t("editStay.loading")}</Text>
      </View>
    );
  }

  const place = parsePlaceJson(stay.place_json);

  return (
    <>
      <Stack.Screen options={{
        title: t("editStay.title"),
        headerLeft: () => (
          <Pressable onPress={() => router.back()} hitSlop={8}>
            <Ionicons name="close" size={24} color={themeColors.text} />
          </Pressable>
        ),
      }} />
      <ScrollView style={[styles.container, { backgroundColor: themeColors.bg }]} contentContainerStyle={styles.scrollContent}>
        {/* Time and Duration */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("editStay.time")}</Text>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={20} color={themeColors.primary} />
            <Text style={[styles.timeValue, { color: themeColors.text }]}>
              {formatTime(stay.start_ts)} 〜 {formatTime(stay.end_ts)}
            </Text>
            <Text style={[styles.durationValue, { color: themeColors.textMuted }]}>
              ({durationLabel(stay.start_ts, stay.end_ts, t)})
            </Text>
          </View>
        </View>

        {/* Place Info */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("editStay.placeInfo")}</Text>
            <Pressable onPress={handleReEnrich} disabled={enriching} style={[styles.reEnrichBtn, { backgroundColor: themeColors.primaryLight }]}>
              <Ionicons name="refresh" size={14} color={themeColors.primary} />
              <Text style={[styles.reEnrichText, { color: themeColors.primary }]}>
                {enriching ? t("editStay.estimating") : t("editStay.reEstimate")}
              </Text>
            </Pressable>
          </View>
          {place.name && (
            <View style={[styles.placeRow, { borderBottomColor: themeColors.divider }]}>
              <Text style={[styles.placeLabel, { color: themeColors.textSecondary }]}>{t("editStay.detectedPlace")}</Text>
              <Text style={[styles.placeValue, { color: themeColors.text }]}>{place.name}</Text>
            </View>
          )}
          {place.category && (
            <View style={[styles.placeRow, { borderBottomColor: themeColors.divider }]}>
              <Text style={[styles.placeLabel, { color: themeColors.textSecondary }]}>{t("editStay.category")}</Text>
              <Text style={[styles.placeValue, { color: themeColors.text }]}>
                {t(`category.${place.category}`) || place.category}
              </Text>
            </View>
          )}
          <View style={[styles.placeRow, { borderBottomColor: themeColors.divider }]}>
            <Text style={[styles.placeLabel, { color: themeColors.textSecondary }]}>{t("editStay.coordinates")}</Text>
            <Text style={[styles.coordValue, { color: themeColors.textMuted }]}>
              {stay.lat.toFixed(5)}, {stay.lng.toFixed(5)}
            </Text>
          </View>
          {place.count > 1 && (
            <Text style={[styles.placeNote, { color: themeColors.textMuted }]}>
              {t("editStay.nearbyPlaces", { count: place.count })}
            </Text>
          )}
        </View>

        {/* Edit Place Name */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("editStay.placeName")}</Text>
          <TextInput
            style={[styles.input, { borderColor: themeColors.surfaceBorder, color: themeColors.text, backgroundColor: themeColors.bg }]}
            placeholder={t("editStay.placeNamePlaceholder")}
            value={editName}
            onChangeText={setEditName}
            placeholderTextColor={themeColors.textMuted}
            returnKeyType="done"
          />
        </View>

        {/* Activity Selection */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("editStay.activityLabel")}</Text>
          <View style={styles.activityGrid}>
            {ACTIVITY_OPTIONS.map((act) => (
              <Pressable
                key={act}
                style={[
                  styles.activityBtn,
                  { backgroundColor: themeColors.divider, borderColor: "transparent" },
                  selectedActivity === act && { backgroundColor: themeColors.primaryLight, borderColor: themeColors.primary },
                ]}
                onPress={() => setSelectedActivity(act)}
              >
                <Text
                  style={[
                    styles.activityBtnText,
                    { color: themeColors.textSecondary },
                    selectedActivity === act && { color: themeColors.primary },
                  ]}
                >
                  {t(`activity.${act}`)}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Memo */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("editStay.memo")}</Text>
          <TextInput
            style={[styles.input, styles.memoInput, { borderColor: themeColors.surfaceBorder, color: themeColors.text, backgroundColor: themeColors.bg }]}
            placeholder={t("editStay.memoPlaceholder")}
            value={memo}
            onChangeText={setMemo}
            placeholderTextColor={themeColors.textMuted}
            maxLength={200}
            multiline
            returnKeyType="done"
          />
        </View>

        {/* Photos */}
        <View style={[styles.section, { backgroundColor: themeColors.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("editStay.photos")}</Text>
            <Pressable onPress={handleReMatchPhotos} disabled={reMatching} style={[styles.reEnrichBtn, { backgroundColor: themeColors.primaryLight }]}>
              <Ionicons name="images-outline" size={14} color={themeColors.primary} />
              <Text style={[styles.reEnrichText, { color: themeColors.primary }]}>
                {reMatching ? t("editStay.reMatching") : t("editStay.reMatch")}
              </Text>
            </Pressable>
          </View>
          {photos.length > 0 ? (
            <View style={styles.photoGrid}>
              {photos.map((p) => (
                <View key={p.id} style={styles.photoItem}>
                  {p.uri && !p.uri.startsWith("ph://") ? (
                    <Image source={{ uri: p.uri }} style={[styles.photoImage, { backgroundColor: themeColors.divider }]} />
                  ) : (
                    <View style={[styles.photoImage, { backgroundColor: themeColors.divider, justifyContent: "center", alignItems: "center" }]}>
                      <Ionicons name="image-outline" size={24} color={themeColors.textMuted} />
                    </View>
                  )}
                  <Pressable
                    style={[styles.photoRemoveBtn, { backgroundColor: themeColors.surface }]}
                    onPress={() => handleRemovePhoto(p.id)}
                  >
                    <Ionicons name="close-circle" size={20} color={themeColors.danger} />
                  </Pressable>
                  <Text style={[styles.photoTime, { color: themeColors.textMuted }]}>
                    {formatTime(p.taken_at)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.photoEmpty, { color: themeColors.textMuted }]}>
              {t("editStay.noPhotosLinked")}
            </Text>
          )}
        </View>

        {/* Needs Review Banner */}
        {stay.needs_review && (
          <View style={styles.reviewBanner}>
            <Ionicons name="alert-circle" size={18} color="#d97706" />
            <Text style={styles.reviewBannerText}>
              {t("editStay.needsReviewBanner")}
            </Text>
          </View>
        )}

        {/* Save Button */}
        <Pressable
          style={[styles.saveBtn, { backgroundColor: themeColors.primary }, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: themeColors.textOnPrimary }]}>
            {saving ? t("editStay.saving") : t("editStay.save")}
          </Text>
        </Pressable>
      </ScrollView>
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
  section: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 3,
    elevation: 1,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 4,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  timeRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  timeValue: {
    fontSize: 18,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  durationValue: {
    fontSize: 14,
  },
  placeRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 6,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  placeLabel: {
    fontSize: 14,
  },
  placeValue: {
    fontSize: 14,
    fontWeight: "500",
  },
  coordValue: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
  },
  placeNote: {
    fontSize: 12,
    marginTop: 6,
  },
  reEnrichBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 6,
  },
  reEnrichText: {
    fontSize: 12,
    fontWeight: "500",
  },
  input: {
    borderWidth: 1,
    borderRadius: 8,
    padding: 12,
    fontSize: 15,
  },
  memoInput: {
    minHeight: 80,
    textAlignVertical: "top",
  },
  activityGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  activityBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1.5,
  },
  activityBtnText: {
    fontSize: 14,
    fontWeight: "500",
  },
  photoGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  photoItem: {
    position: "relative",
  },
  photoImage: {
    width: 80,
    height: 80,
    borderRadius: 8,
  },
  photoRemoveBtn: {
    position: "absolute",
    top: -6,
    right: -6,
    borderRadius: 10,
  },
  photoTime: {
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
  },
  photoEmpty: {
    fontSize: 13,
    textAlign: "center",
    paddingVertical: 12,
  },
  reviewBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fffbeb",
    borderRadius: 12,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#fef3c7",
  },
  reviewBannerText: {
    flex: 1,
    fontSize: 13,
    color: "#92400e",
    lineHeight: 18,
  },
  saveBtn: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  saveBtnDisabled: {
    opacity: 0.6,
  },
  saveBtnText: {
    fontSize: 16,
    fontWeight: "600",
  },
});
