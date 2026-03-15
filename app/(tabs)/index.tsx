import { Ionicons } from "@expo/vector-icons";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";

import { getRawEventCount } from "@/core/storage/rawEventRepo";
import {
  startBackgroundLocation,
} from "@/core/location/backgroundTask";
import {
  useLocationPermission,
  type PermissionState,
} from "@/features/location/useLocationPermission";

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

export default function HomeScreen() {
  const db = useSQLiteContext();
  const { status, loading, requestAlways, openSettings } = useLocationPermission();
  const [eventCount, setEventCount] = useState(0);
  const [bgStarted, setBgStarted] = useState(false);

  const refreshCount = useCallback(async () => {
    const count = await getRawEventCount(db);
    setEventCount(count);
  }, [db]);

  useEffect(() => {
    refreshCount();
    const interval = setInterval(refreshCount, 10_000);
    return () => clearInterval(interval);
  }, [refreshCount]);

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
            <Text style={styles.statusLabel}>記録イベント数</Text>
            <Text style={styles.statusValue}>{eventCount}</Text>
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
