import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";

import { getSetting, setSetting } from "@/core/storage/settingsRepo";
import { getHomeLocation, refreshHomeLocation, type HomeLocation } from "@/core/engine/homeDetector";
import { seedTestDay, clearAllData } from "@/core/debug/seedTestData";
import {
  usePhotoPermission,
  type PhotoPermissionState,
} from "@/features/photos/usePhotoPermission";
import { useSubscription } from "@/features/monetization/SubscriptionContext";
import { useTheme } from "@/features/theme/ThemeContext";
import { THEME_LIST, type ThemeId } from "@/features/theme/colors";

function parseTime(val: string): { h: number; m: number } {
  const [h, m] = val.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function formatTimeStr(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function cycleHour(current: string, delta: number): string {
  const { h, m } = parseTime(current);
  const next = (h + delta + 24) % 24;
  return formatTimeStr(next, m);
}

function cycleMinute(current: string, delta: number): string {
  const { h, m } = parseTime(current);
  const next = (m + delta + 60) % 60;
  return formatTimeStr(h, next);
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { theme: t, themeId, setThemeId } = useTheme();

  const [dayEndTime, setDayEndTime] = useState<string>("03:00");
  const [excludeScreenshots, setExcludeScreenshots] = useState(true);
  const [homeLocation, setHomeLocation] = useState<HomeLocation | null>(null);
  const { status: photoStatus, request: requestPhotoPermission, openSettings: openPhotoSettings } = usePhotoPermission();
  const { isPro, purchase, restore, toggleDevPro } = useSubscription();

  useEffect(() => {
    (async () => {
      const de = await getSetting(db, "day_end_time");
      if (de) setDayEndTime(de);
      const es = await getSetting(db, "exclude_screenshots");
      setExcludeScreenshots(es !== "false");
      const h = await getHomeLocation(db);
      setHomeLocation(h);
    })();
  }, [db]);

  const updateDayEndTime = useCallback(
    async (next: string) => {
      setDayEndTime(next);
      await setSetting(db, "day_end_time", next);
    },
    [db],
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: t.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Theme Selector */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>テーマ</Text>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.surfaceBorder }]}>
          <View style={styles.themeRow}>
            {THEME_LIST.map((th) => {
              const selected = themeId === th.id;
              return (
                <Pressable
                  key={th.id}
                  style={[
                    styles.themeOption,
                    selected && { borderColor: t.primary },
                  ]}
                  onPress={() => setThemeId(th.id as ThemeId)}
                >
                  <View style={styles.themePreview}>
                    <View style={[styles.themeCircle, { backgroundColor: th.primary }]} />
                    <View style={[styles.themeCircle, { backgroundColor: th.accent }]} />
                    <View style={[styles.themeCircle, { backgroundColor: th.bg, borderWidth: 1, borderColor: th.surfaceBorder }]} />
                  </View>
                  <Text style={[
                    styles.themeName,
                    { color: selected ? t.primary : t.textSecondary },
                    selected && { fontWeight: "700" },
                  ]}>{th.name}</Text>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={16} color={t.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Time Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>時刻設定</Text>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.surfaceBorder }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: t.text }]}>活動終了時刻</Text>
              <Text style={[styles.settingDescription, { color: t.textMuted }]}>1日の区切り時刻</Text>
            </View>
            <View style={styles.timePickerRow}>
              <View style={styles.timeUnit}>
                <Pressable style={styles.arrowButton} onPress={() => updateDayEndTime(cycleHour(dayEndTime, 1))}>
                  <Ionicons name="chevron-up" size={18} color={t.textSecondary} />
                </Pressable>
                <Text style={[styles.timeText, { color: t.text }]}>{String(parseTime(dayEndTime).h).padStart(2, "0")}</Text>
                <Pressable style={styles.arrowButton} onPress={() => updateDayEndTime(cycleHour(dayEndTime, -1))}>
                  <Ionicons name="chevron-down" size={18} color={t.textSecondary} />
                </Pressable>
              </View>
              <Text style={[styles.timeSeparator, { color: t.text }]}>:</Text>
              <View style={styles.timeUnit}>
                <Pressable style={styles.arrowButton} onPress={() => updateDayEndTime(cycleMinute(dayEndTime, 15))}>
                  <Ionicons name="chevron-up" size={18} color={t.textSecondary} />
                </Pressable>
                <Text style={[styles.timeText, { color: t.text }]}>{String(parseTime(dayEndTime).m).padStart(2, "0")}</Text>
                <Pressable style={styles.arrowButton} onPress={() => updateDayEndTime(cycleMinute(dayEndTime, -15))}>
                  <Ionicons name="chevron-down" size={18} color={t.textSecondary} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Permissions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>パーミッション</Text>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.surfaceBorder }]}>
          <View style={styles.menuRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: t.text }]}>写真アクセス</Text>
              <Text style={[styles.settingDescription, { color: t.textMuted }]}>
                滞在中の写真を自動で紐づけます
              </Text>
            </View>
            {photoStatus === "granted" ? (
              <View style={[styles.permBadge, { backgroundColor: "#dcfce7" }]}>
                <Text style={[styles.permBadgeText, { color: t.success }]}>許可済み</Text>
              </View>
            ) : photoStatus === "limited" ? (
              <Pressable style={[styles.permBadge, { backgroundColor: "#fef3c7" }]} onPress={openPhotoSettings}>
                <Text style={[styles.permBadgeText, { color: t.warning }]}>一部許可</Text>
              </Pressable>
            ) : photoStatus === "denied" ? (
              <Pressable style={[styles.permBadge, { backgroundColor: "#fee2e2" }]} onPress={openPhotoSettings}>
                <Text style={[styles.permBadgeText, { color: t.danger }]}>拒否</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.permBadge, { backgroundColor: t.primaryLight }]} onPress={requestPhotoPermission}>
                <Text style={[styles.permBadgeText, { color: t.primary }]}>許可する</Text>
              </Pressable>
            )}
          </View>
          <View style={[styles.divider, { backgroundColor: t.surfaceBorder }]} />
          <View style={styles.menuRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: t.text }]}>スクリーンショットを除外</Text>
              <Text style={[styles.settingDescription, { color: t.textMuted }]}>
                写真マッチングからスクショを除外します
              </Text>
            </View>
            <Switch
              value={excludeScreenshots}
              onValueChange={async (val) => {
                setExcludeScreenshots(val);
                await setSetting(db, "exclude_screenshots", val ? "true" : "false");
              }}
              trackColor={{ false: t.surfaceBorder, true: t.switchTrack }}
              thumbColor={excludeScreenshots ? t.primary : "#f4f4f5"}
            />
          </View>
        </View>
      </View>

      {/* Data */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>データ</Text>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.surfaceBorder }]}>
          <Pressable style={styles.menuRow} onPress={() => router.push("/export")}>
            <Text style={[styles.menuLabel, { color: t.text }]}>エクスポート</Text>
            <Ionicons name="chevron-forward" size={20} color={t.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Home Detection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>ホーム判定</Text>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.surfaceBorder }]}>
          <View style={styles.menuRow}>
            <Text style={[styles.menuLabel, { color: t.text }]}>ステータス</Text>
            <Text style={[styles.menuValue, { color: t.textMuted }]}>
              {homeLocation
                ? `判定済み (${homeLocation.lat.toFixed(3)}, ${homeLocation.lng.toFixed(3)})`
                : "未判定（データ蓄積中）"}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: t.surfaceBorder }]} />
          <Pressable
            style={styles.menuRow}
            onPress={async () => {
              const h = await refreshHomeLocation(db);
              setHomeLocation(h);
              Alert.alert(
                "ホーム判定",
                h ? `自宅を更新しました（${h.count}泊分のデータ）` : "まだ十分なデータがありません（3泊以上必要）",
              );
            }}
          >
            <Text style={[styles.menuLabel, { color: t.primary }]}>再判定する</Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: t.surfaceBorder }]} />
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              Alert.alert("ホーム判定をリセット", "蓄積したホーム判定データをリセットしますか？", [
                { text: "キャンセル", style: "cancel" },
                {
                  text: "リセット",
                  style: "destructive",
                  onPress: async () => {
                    await setSetting(db, "home_location", "");
                    setHomeLocation(null);
                  },
                },
              ])
            }
          >
            <Text style={[styles.menuLabel, { color: t.danger }]}>ホーム判定をリセット</Text>
          </Pressable>
        </View>
      </View>

      {/* Subscription */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>サブスクリプション</Text>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.surfaceBorder }]}>
          <View style={styles.menuRow}>
            <Text style={[styles.menuLabel, { color: t.text }]}>プラン</Text>
            <View style={[styles.permBadge, { backgroundColor: isPro ? t.primaryLight : t.divider }]}>
              <Text style={[styles.permBadgeText, { color: isPro ? t.primary : t.textSecondary }]}>
                {isPro ? "Pro（広告なし）" : "Free（広告あり）"}
              </Text>
            </View>
          </View>
          {!isPro && (
            <>
              <View style={[styles.divider, { backgroundColor: t.surfaceBorder }]} />
              <Pressable
                style={styles.menuRow}
                onPress={async () => {
                  try {
                    const ok = await purchase();
                    Alert.alert(
                      ok ? "ありがとうございます" : "購入",
                      ok ? "Proプランにアップグレードしました" : "購入がキャンセルされたか、まだ設定されていません",
                    );
                  } catch (e) {
                    Alert.alert("エラー", String(e));
                  }
                }}
              >
                <Text style={[styles.menuLabel, { color: t.primary }]}>Proにアップグレード</Text>
              </Pressable>
            </>
          )}
          <View style={[styles.divider, { backgroundColor: t.surfaceBorder }]} />
          <Pressable
            style={styles.menuRow}
            onPress={async () => {
              try {
                const ok = await restore();
                Alert.alert("購入の復元", ok ? "Proプランを復元しました" : "復元可能な購入が見つかりませんでした");
              } catch (e) {
                Alert.alert("エラー", String(e));
              }
            }}
          >
            <Text style={[styles.menuLabel, { color: t.text }]}>購入を復元</Text>
          </Pressable>
          {__DEV__ && (
            <>
              <View style={[styles.divider, { backgroundColor: t.surfaceBorder }]} />
              <View style={styles.menuRow}>
                <Text style={[styles.menuLabel, { color: t.warning }]}>🛠 Dev: Pro切替</Text>
                <Switch value={isPro} onValueChange={toggleDevPro} />
              </View>
            </>
          )}
        </View>
      </View>

      {/* Debug */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: t.textSecondary }]}>デバッグ</Text>
        <View style={[styles.card, { backgroundColor: t.surface, borderColor: t.surfaceBorder }]}>
          <Pressable
            style={styles.menuRow}
            onPress={async () => {
              try {
                const result = await seedTestDay(db, 0);
                Alert.alert("テストデータ生成完了", `今日: ${result.events}イベント → ${result.stays}滞在を検出`);
              } catch (e) {
                Alert.alert("エラー", String(e));
              }
            }}
          >
            <Text style={[styles.menuLabel, { color: t.text }]}>今日のテストデータを生成</Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: t.surfaceBorder }]} />
          <Pressable
            style={styles.menuRow}
            onPress={async () => {
              try {
                const r0 = await seedTestDay(db, 1);
                const r1 = await seedTestDay(db, 2);
                Alert.alert("テストデータ生成完了", `昨日: ${r0.events}イベント → ${r0.stays}滞在\n一昨日: ${r1.events}イベント → ${r1.stays}滞在`);
              } catch (e) {
                Alert.alert("エラー", String(e));
              }
            }}
          >
            <Text style={[styles.menuLabel, { color: t.text }]}>過去2日分のテストデータを生成</Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: t.surfaceBorder }]} />
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              Alert.alert("全データを削除", "RawEvent・Stay・日記をすべて削除します。", [
                { text: "キャンセル", style: "cancel" },
                {
                  text: "削除",
                  style: "destructive",
                  onPress: async () => {
                    await clearAllData(db);
                    Alert.alert("完了", "全データを削除しました");
                  },
                },
              ])
            }
          >
            <Text style={[styles.menuLabel, { color: t.danger }]}>全データを削除</Text>
          </Pressable>
        </View>
      </View>

      <Text style={[styles.version, { color: t.textMuted }]}>TraceNote v0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: 16,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  card: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  themeRow: {
    flexDirection: "row",
    padding: 12,
    gap: 10,
  },
  themeOption: {
    flex: 1,
    alignItems: "center",
    padding: 10,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: "transparent",
    gap: 6,
  },
  themePreview: {
    flexDirection: "row",
    gap: 4,
  },
  themeCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
  },
  themeName: {
    fontSize: 12,
    fontWeight: "500",
  },
  settingRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: "500",
  },
  settingDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  timePickerRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  timeUnit: {
    alignItems: "center",
    width: 44,
  },
  arrowButton: {
    padding: 4,
  },
  timeText: {
    fontSize: 22,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
  },
  timeSeparator: {
    fontSize: 22,
    fontWeight: "600",
    marginHorizontal: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  menuRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  menuLabel: {
    fontSize: 16,
  },
  menuValue: {
    fontSize: 15,
  },
  permBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
  },
  permBadgeText: {
    fontSize: 13,
    fontWeight: "600",
  },
  version: {
    textAlign: "center",
    fontSize: 13,
    marginTop: 8,
    marginBottom: 32,
  },
});
