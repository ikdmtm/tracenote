import { Ionicons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";
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
  TextInput,
  View,
} from "react-native";

import type { Stay, StayPhoto } from "@/core/domain/models";
import { useTheme } from "@/features/theme/ThemeContext";
import { ACTIVITY_LABELS, type Activity } from "@/core/engine/activityInference";
import { CATEGORY_LABELS, type PlaceCategory } from "@/core/places/categories";
import { getStayById, updateStay } from "@/core/storage/stayRepo";
import { getPhotosByStayId, insertStayPhoto, deleteStayPhoto } from "@/core/storage/stayPhotoRepo";
import { enrichStay } from "@/core/engine/enrichService";
import { matchPhotosForStay } from "@/core/photos/photoMatcher";
import { getSetting } from "@/core/storage/settingsRepo";

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
  const { theme: t } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const db = useSQLiteContext();
  const router = useRouter();

  const [stay, setStay] = useState<Stay | null>(null);
  const [photos, setPhotos] = useState<StayPhoto[]>([]);
  const [editName, setEditName] = useState("");
  const [selectedActivity, setSelectedActivity] = useState<Activity | null>(null);
  const [saving, setSaving] = useState(false);
  const [enriching, setEnriching] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
    const s = await getStayById(db, Number(id));
    if (!s) {
      Alert.alert("エラー", "この滞在が見つかりません");
      router.back();
      return;
    }
    setStay(s);
    setEditName(s.user_place_name ?? "");
    setSelectedActivity((s.activity as Activity) ?? null);
    const p = await getPhotosByStayId(db, s.id);
    setPhotos(p);
  }, [db, id, router]);

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
        needs_review: false,
      });
      router.back();
    } catch (e) {
      Alert.alert("エラー", "保存に失敗しました");
    } finally {
      setSaving(false);
    }
  }, [db, stay, editName, selectedActivity, router]);

  const handleReEnrich = useCallback(async () => {
    if (!stay) return;
    setEnriching(true);
    try {
      await enrichStay(db, stay);
      await load();
    } catch (e) {
      Alert.alert("エラー", "再推定に失敗しました");
    } finally {
      setEnriching(false);
    }
  }, [db, stay, load]);

  const handleRemovePhoto = useCallback(async (photoId: number) => {
    await deleteStayPhoto(db, photoId);
    setPhotos((prev) => prev.filter((p) => p.id !== photoId));
  }, [db]);

  const handleReMatchPhotos = useCallback(async () => {
    if (!stay) return;
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
        Alert.alert("完了", `${added}枚の写真を追加しました`);
      } else {
        Alert.alert("結果", "新しい写真は見つかりませんでした");
      }
    } catch (e) {
      Alert.alert("エラー", "写真の再マッチングに失敗しました");
    }
  }, [db, stay, photos]);

  const handleAddFromLibrary = useCallback(async () => {
    if (!stay) return;
    const { status } = await MediaLibrary.getPermissionsAsync();
    if (status !== MediaLibrary.PermissionStatus.GRANTED) {
      Alert.alert("写真アクセスが必要", "設定から写真へのアクセスを許可してください。");
      return;
    }
    // Fetch recent photos and let user see what's available
    const recent = await MediaLibrary.getAssetsAsync({
      mediaType: MediaLibrary.MediaType.photo,
      sortBy: [MediaLibrary.SortBy.creationTime],
      first: 50,
    });
    if (recent.assets.length === 0) {
      Alert.alert("写真なし", "カメラロールに写真がありません");
      return;
    }
    // For now, auto-match is the primary flow. Manual add is via re-match.
    await handleReMatchPhotos();
  }, [stay, handleReMatchPhotos]);

  if (!stay) {
    return (
      <View style={[styles.container, { backgroundColor: t.bg }]}>
        <Text style={[styles.loadingText, { color: t.textMuted }]}>読み込み中...</Text>
      </View>
    );
  }

  const place = parsePlaceJson(stay.place_json);

  return (
    <>
      <Stack.Screen options={{ title: "滞在の編集", headerBackTitle: "戻る" }} />
      <ScrollView style={[styles.container, { backgroundColor: t.bg }]} contentContainerStyle={styles.scrollContent}>
        {/* Time and Duration */}
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>時間</Text>
          <View style={styles.timeRow}>
            <Ionicons name="time-outline" size={20} color={t.primary} />
            <Text style={[styles.timeValue, { color: t.text }]}>
              {formatTime(stay.start_ts)} 〜 {formatTime(stay.end_ts)}
            </Text>
            <Text style={[styles.durationValue, { color: t.textMuted }]}>
              ({durationLabel(stay.start_ts, stay.end_ts)})
            </Text>
          </View>
        </View>

        {/* Place Info */}
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>場所情報</Text>
            <Pressable onPress={handleReEnrich} disabled={enriching} style={[styles.reEnrichBtn, { backgroundColor: t.primaryLight }]}>
              <Ionicons name="refresh" size={14} color={t.primary} />
              <Text style={[styles.reEnrichText, { color: t.primary }]}>
                {enriching ? "推定中..." : "再推定"}
              </Text>
            </Pressable>
          </View>
          {place.name && (
            <View style={[styles.placeRow, { borderBottomColor: t.divider }]}>
              <Text style={[styles.placeLabel, { color: t.textSecondary }]}>検出場所</Text>
              <Text style={[styles.placeValue, { color: t.text }]}>{place.name}</Text>
            </View>
          )}
          {place.category && (
            <View style={[styles.placeRow, { borderBottomColor: t.divider }]}>
              <Text style={[styles.placeLabel, { color: t.textSecondary }]}>カテゴリ</Text>
              <Text style={[styles.placeValue, { color: t.text }]}>
                {CATEGORY_LABELS[place.category] ?? place.category}
              </Text>
            </View>
          )}
          <View style={[styles.placeRow, { borderBottomColor: t.divider }]}>
            <Text style={[styles.placeLabel, { color: t.textSecondary }]}>座標</Text>
            <Text style={[styles.coordValue, { color: t.textMuted }]}>
              {stay.lat.toFixed(5)}, {stay.lng.toFixed(5)}
            </Text>
          </View>
          {place.count > 1 && (
            <Text style={[styles.placeNote, { color: t.textMuted }]}>
              周辺に {place.count} 件の施設を検出
            </Text>
          )}
        </View>

        {/* Edit Place Name */}
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>場所名（カスタム）</Text>
          <TextInput
            style={[styles.input, { borderColor: t.surfaceBorder, color: t.text, backgroundColor: t.bg }]}
            placeholder="例: 自宅、会社、〇〇カフェ..."
            value={editName}
            onChangeText={setEditName}
            placeholderTextColor={t.textMuted}
            returnKeyType="done"
          />
        </View>

        {/* Activity Selection */}
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>行動ラベル</Text>
          <View style={styles.activityGrid}>
            {ACTIVITY_OPTIONS.map((act) => (
              <Pressable
                key={act}
                style={[
                  styles.activityBtn,
                  { backgroundColor: t.divider, borderColor: "transparent" },
                  selectedActivity === act && { backgroundColor: t.primaryLight, borderColor: t.primary },
                ]}
                onPress={() => setSelectedActivity(act)}
              >
                <Text
                  style={[
                    styles.activityBtnText,
                    { color: t.textSecondary },
                    selectedActivity === act && { color: t.primary },
                  ]}
                >
                  {ACTIVITY_LABELS[act]}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Photos */}
        <View style={[styles.section, { backgroundColor: t.surface }]}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>写真</Text>
            <Pressable onPress={handleReMatchPhotos} style={[styles.reEnrichBtn, { backgroundColor: t.primaryLight }]}>
              <Ionicons name="images-outline" size={14} color={t.primary} />
              <Text style={[styles.reEnrichText, { color: t.primary }]}>再マッチ</Text>
            </Pressable>
          </View>
          {photos.length > 0 ? (
            <View style={styles.photoGrid}>
              {photos.map((p) => (
                <View key={p.id} style={styles.photoItem}>
                  {p.uri && !p.uri.startsWith("ph://") ? (
                    <Image source={{ uri: p.uri }} style={[styles.photoImage, { backgroundColor: t.divider }]} />
                  ) : (
                    <View style={[styles.photoImage, { backgroundColor: t.divider, justifyContent: "center", alignItems: "center" }]}>
                      <Ionicons name="image-outline" size={24} color={t.textMuted} />
                    </View>
                  )}
                  <Pressable
                    style={[styles.photoRemoveBtn, { backgroundColor: t.surface }]}
                    onPress={() => handleRemovePhoto(p.id)}
                  >
                    <Ionicons name="close-circle" size={20} color={t.danger} />
                  </Pressable>
                  <Text style={[styles.photoTime, { color: t.textMuted }]}>
                    {formatTime(p.taken_at)}
                  </Text>
                </View>
              ))}
            </View>
          ) : (
            <Text style={[styles.photoEmpty, { color: t.textMuted }]}>
              この滞在に紐づく写真はありません
            </Text>
          )}
        </View>

        {/* Needs Review Banner */}
        {stay.needs_review && (
          <View style={styles.reviewBanner}>
            <Ionicons name="alert-circle" size={18} color="#d97706" />
            <Text style={styles.reviewBannerText}>
              この滞在は自動推定の確信度が低いため確認をお願いします
            </Text>
          </View>
        )}

        {/* Save Button */}
        <Pressable
          style={[styles.saveBtn, { backgroundColor: t.primary }, saving && styles.saveBtnDisabled]}
          onPress={handleSave}
          disabled={saving}
        >
          <Text style={[styles.saveBtnText, { color: t.textOnPrimary }]}>
            {saving ? "保存中..." : "保存する"}
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
