import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { DIARY } from "@/core/constants";
import { getSetting, setSetting } from "@/core/storage/settingsRepo";

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

  const [dayEndTime, setDayEndTime] = useState<string>(DIARY.DEFAULT_DAY_END_TIME);
  const [genTime, setGenTime] = useState<string>(DIARY.DEFAULT_GENERATION_TIME);

  useEffect(() => {
    (async () => {
      const de = await getSetting(db, "day_end_time");
      const gt = await getSetting(db, "generation_time");
      if (de) setDayEndTime(de);
      if (gt) setGenTime(gt);
    })();
  }, [db]);

  const updateDayEndTime = useCallback(
    async (next: string) => {
      setDayEndTime(next);
      await setSetting(db, "day_end_time", next);
    },
    [db],
  );

  const updateGenTime = useCallback(
    async (next: string) => {
      setGenTime(next);
      await setSetting(db, "generation_time", next);
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
          <View style={styles.divider} />
          <TimeSettingRow
            label="日記生成時刻"
            description="前日分の日記を自動生成する時刻"
            value={genTime}
            onChangeHour={(d) =>
              updateGenTime(cycleHour(genTime, d))
            }
            onChangeMinute={(d) =>
              updateGenTime(cycleMinute(genTime, d))
            }
          />
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
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              Alert.alert(
                "ホーム判定をリセット",
                "蓄積したホーム判定データをリセットしますか？",
                [
                  { text: "キャンセル", style: "cancel" },
                  { text: "リセット", style: "destructive" },
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
            <Text style={styles.menuValue}>Free（広告あり）</Text>
          </View>
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
  version: {
    textAlign: "center",
    fontSize: 13,
    color: "#cbd5e1",
    marginTop: 8,
    marginBottom: 32,
  },
});
