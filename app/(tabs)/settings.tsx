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

function parseTime(val: string): { h: number; m: number } {
  const [h, m] = val.split(":").map(Number);
  return { h: h ?? 0, m: m ?? 0 };
}

function formatTime(h: number, m: number): string {
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function cycleHour(current: string, delta: number): string {
  const { h, m } = parseTime(current);
  const next = (h + delta + 24) % 24;
  return formatTime(next, m);
}

function cycleMinute(current: string, delta: number): string {
  const { h, m } = parseTime(current);
  const next = (m + delta + 60) % 60;
  return formatTime(h, next);
}

type SettingRowProps = {
  label: string;
  description: string;
  value: string;
  onChangeHour: (delta: number) => void;
  onChangeMinute: (delta: number) => void;
};

function TimeSettingRow({
  label,
  description,
  value,
  onChangeHour,
  onChangeMinute,
}: SettingRowProps) {
  const { h, m } = parseTime(value);
  return (
    <View style={styles.settingRow}>
      <View style={styles.settingInfo}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.settingDescription}>{description}</Text>
      </View>
      <View style={styles.timePickerRow}>
        <View style={styles.timeUnit}>
          <Pressable
            style={styles.arrowButton}
            onPress={() => onChangeHour(1)}
          >
            <Ionicons name="chevron-up" size={18} color="#64748b" />
          </Pressable>
          <Text style={styles.timeText}>{String(h).padStart(2, "0")}</Text>
          <Pressable
            style={styles.arrowButton}
            onPress={() => onChangeHour(-1)}
          >
            <Ionicons name="chevron-down" size={18} color="#64748b" />
          </Pressable>
        </View>
        <Text style={styles.timeSeparator}>:</Text>
        <View style={styles.timeUnit}>
          <Pressable
            style={styles.arrowButton}
            onPress={() => onChangeMinute(15)}
          >
            <Ionicons name="chevron-up" size={18} color="#64748b" />
          </Pressable>
          <Text style={styles.timeText}>{String(m).padStart(2, "0")}</Text>
          <Pressable
            style={styles.arrowButton}
            onPress={() => onChangeMinute(-15)}
          >
            <Ionicons name="chevron-down" size={18} color="#64748b" />
          </Pressable>
        </View>
      </View>
    </View>
  );
}

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [dayEndTime, setDayEndTime] = useState<string>("03:00");
  const [excludeScreenshots, setExcludeScreenshots] = useState(true);
  const [homeLocation, setHomeLocation] = useState<HomeLocation | null>(null);
  const { status: photoStatus, request: requestPhotoPermission, openSettings: openPhotoSettings } = usePhotoPermission();
  const { isPro, purchase, restore } = useSubscription();

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
      style={styles.container}
      contentContainerStyle={styles.content}
    >
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>時刻設定</Text>
        <View style={styles.card}>
          <TimeSettingRow
            label="活動終了時刻"
            description="1日の区切り時刻"
            value={dayEndTime}
            onChangeHour={(d) =>
              updateDayEndTime(cycleHour(dayEndTime, d))
            }
            onChangeMinute={(d) =>
              updateDayEndTime(cycleMinute(dayEndTime, d))
            }
          />
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>パーミッション</Text>
        <View style={styles.card}>
          <View style={styles.menuRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>写真アクセス</Text>
              <Text style={styles.settingDescription}>
                滞在中の写真を自動で紐づけます
              </Text>
            </View>
            {photoStatus === "granted" ? (
              <View style={[styles.permBadge, { backgroundColor: "#dcfce7" }]}>
                <Text style={[styles.permBadgeText, { color: "#16a34a" }]}>許可済み</Text>
              </View>
            ) : photoStatus === "limited" ? (
              <Pressable
                style={[styles.permBadge, { backgroundColor: "#fef3c7" }]}
                onPress={openPhotoSettings}
              >
                <Text style={[styles.permBadgeText, { color: "#d97706" }]}>一部許可</Text>
              </Pressable>
            ) : photoStatus === "denied" ? (
              <Pressable
                style={[styles.permBadge, { backgroundColor: "#fee2e2" }]}
                onPress={openPhotoSettings}
              >
                <Text style={[styles.permBadgeText, { color: "#dc2626" }]}>拒否</Text>
              </Pressable>
            ) : (
              <Pressable
                style={[styles.permBadge, { backgroundColor: "#eff6ff" }]}
                onPress={requestPhotoPermission}
              >
                <Text style={[styles.permBadgeText, { color: "#3b82f6" }]}>許可する</Text>
              </Pressable>
            )}
          </View>
          <View style={styles.divider} />
          <View style={styles.menuRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.menuLabel}>スクリーンショットを除外</Text>
              <Text style={styles.settingDescription}>
                写真マッチングからスクショを除外します
              </Text>
            </View>
            <Switch
              value={excludeScreenshots}
              onValueChange={async (val) => {
                setExcludeScreenshots(val);
                await setSetting(db, "exclude_screenshots", val ? "true" : "false");
              }}
              trackColor={{ false: "#e2e8f0", true: "#93c5fd" }}
              thumbColor={excludeScreenshots ? "#3b82f6" : "#f4f4f5"}
            />
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>データ</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.menuRow}
            onPress={() => router.push("/export")}
          >
            <Text style={styles.menuLabel}>エクスポート</Text>
            <Ionicons name="chevron-forward" size={20} color="#94a3b8" />
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>ホーム判定</Text>
        <View style={styles.card}>
          <View style={styles.menuRow}>
            <Text style={styles.menuLabel}>ステータス</Text>
            <Text style={styles.menuValue}>
              {homeLocation
                ? `判定済み (${homeLocation.lat.toFixed(3)}, ${homeLocation.lng.toFixed(3)})`
                : "未判定（データ蓄積中）"}
            </Text>
          </View>
          <View style={styles.divider} />
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
            <Text style={[styles.menuLabel, { color: "#3b82f6" }]}>再判定する</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              Alert.alert(
                "ホーム判定をリセット",
                "蓄積したホーム判定データをリセットしますか？",
                [
                  { text: "キャンセル", style: "cancel" },
                  {
                    text: "リセット",
                    style: "destructive",
                    onPress: async () => {
                      await setSetting(db, "home_location", "");
                      setHomeLocation(null);
                    },
                  },
                ],
              )
            }
          >
            <Text style={[styles.menuLabel, { color: "#ef4444" }]}>
              ホーム判定をリセット
            </Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>サブスクリプション</Text>
        <View style={styles.card}>
          <View style={styles.menuRow}>
            <Text style={styles.menuLabel}>プラン</Text>
            <View style={isPro
              ? [styles.permBadge, { backgroundColor: "#dbeafe" }] as any
              : [styles.permBadge, { backgroundColor: "#f1f5f9" }] as any
            }>
              <Text style={isPro
                ? [styles.permBadgeText, { color: "#2563eb" }] as any
                : [styles.permBadgeText, { color: "#64748b" }] as any
              }>
                {isPro ? "Pro（広告なし）" : "Free（広告あり）"}
              </Text>
            </View>
          </View>
          {!isPro && (
            <>
              <View style={styles.divider} />
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
                <Text style={[styles.menuLabel, { color: "#3b82f6" }]}>
                  Proにアップグレード
                </Text>
              </Pressable>
            </>
          )}
          <View style={styles.divider} />
          <Pressable
            style={styles.menuRow}
            onPress={async () => {
              try {
                const ok = await restore();
                Alert.alert(
                  "購入の復元",
                  ok ? "Proプランを復元しました" : "復元可能な購入が見つかりませんでした",
                );
              } catch (e) {
                Alert.alert("エラー", String(e));
              }
            }}
          >
            <Text style={styles.menuLabel}>購入を復元</Text>
          </Pressable>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>デバッグ</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.menuRow}
            onPress={async () => {
              try {
                const result = await seedTestDay(db, 0);
                Alert.alert(
                  "テストデータ生成完了",
                  `今日: ${result.events}イベント → ${result.stays}滞在を検出`,
                );
              } catch (e) {
                Alert.alert("エラー", String(e));
              }
            }}
          >
            <Text style={styles.menuLabel}>今日のテストデータを生成</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={styles.menuRow}
            onPress={async () => {
              try {
                const r0 = await seedTestDay(db, 1);
                const r1 = await seedTestDay(db, 2);
                Alert.alert(
                  "テストデータ生成完了",
                  `昨日: ${r0.events}イベント → ${r0.stays}滞在\n一昨日: ${r1.events}イベント → ${r1.stays}滞在`,
                );
              } catch (e) {
                Alert.alert("エラー", String(e));
              }
            }}
          >
            <Text style={styles.menuLabel}>過去2日分のテストデータを生成</Text>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              Alert.alert(
                "全データを削除",
                "RawEvent・Stay・日記をすべて削除します。",
                [
                  { text: "キャンセル", style: "cancel" },
                  {
                    text: "削除",
                    style: "destructive",
                    onPress: async () => {
                      await clearAllData(db);
                      Alert.alert("完了", "全データを削除しました");
                    },
                  },
                ],
              )
            }
          >
            <Text style={[styles.menuLabel, { color: "#ef4444" }]}>
              全データを削除
            </Text>
          </Pressable>
        </View>
      </View>

      <Text style={styles.version}>TraceNote v0.1.0</Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
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
    color: "#64748b",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
    paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
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
    color: "#0f172a",
  },
  settingDescription: {
    fontSize: 13,
    color: "#94a3b8",
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
    color: "#0f172a",
  },
  timeSeparator: {
    fontSize: 22,
    fontWeight: "600",
    color: "#0f172a",
    marginHorizontal: 2,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e2e8f0",
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
    color: "#0f172a",
  },
  menuValue: {
    fontSize: 15,
    color: "#94a3b8",
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
    color: "#cbd5e1",
    marginTop: 8,
    marginBottom: 32,
  },
});
