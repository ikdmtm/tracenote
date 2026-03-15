import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { exportData, type ExportFormat } from "@/core/export/exporter";
import { CalendarPicker } from "@/features/ui/CalendarPicker";

function fmtDate(d: Date): string {
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(0, 0, 0, 0);
  return d;
}

export default function ExportScreen() {
  const db = useSQLiteContext();
  const router = useRouter();

  const [startDate, setStartDate] = useState(() => daysAgo(7));
  const [endDate, setEndDate] = useState(() => daysAgo(0));
  const [format, setFormat] = useState<ExportFormat>("json");
  const [exporting, setExporting] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handleExport = useCallback(async () => {
    if (startDate > endDate) {
      Alert.alert("エラー", "開始日は終了日より前にしてください");
      return;
    }
    setExporting(true);
    try {
      const filePath = await exportData(db, startDate, endDate, format);
      const canShare = await Sharing.isAvailableAsync();
      if (canShare) {
        await Sharing.shareAsync(filePath, {
          mimeType: format === "json" ? "application/json" : "text/csv",
          UTI: format === "json" ? "public.json" : "public.comma-separated-values-text",
        });
      } else {
        Alert.alert("完了", `ファイルを生成しました:\n${filePath}`);
      }
    } catch (e) {
      Alert.alert("エラー", String(e));
    } finally {
      setExporting(false);
    }
  }, [db, startDate, endDate, format]);

  const handleStartSelect = useCallback((d: Date) => {
    setStartDate(d);
    if (d > endDate) setEndDate(d);
  }, [endDate]);

  const handleEndSelect = useCallback((d: Date) => {
    setEndDate(d);
    if (d < startDate) setStartDate(d);
  }, [startDate]);

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Period Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>期間</Text>
        <View style={styles.card}>
          <Pressable style={styles.dateRow} onPress={() => setShowStartPicker(true)}>
            <Text style={styles.dateLabel}>開始日</Text>
            <View style={styles.dateValue}>
              <Text style={styles.dateText}>{fmtDate(startDate)}</Text>
              <Ionicons name="calendar-outline" size={18} color="#3b82f6" />
            </View>
          </Pressable>
          <View style={styles.divider} />
          <Pressable style={styles.dateRow} onPress={() => setShowEndPicker(true)}>
            <Text style={styles.dateLabel}>終了日</Text>
            <View style={styles.dateValue}>
              <Text style={styles.dateText}>{fmtDate(endDate)}</Text>
              <Ionicons name="calendar-outline" size={18} color="#3b82f6" />
            </View>
          </Pressable>
        </View>

        {/* Quick Presets */}
        <View style={styles.presetRow}>
          <Pressable
            style={styles.presetBtn}
            onPress={() => { setStartDate(daysAgo(7)); setEndDate(daysAgo(0)); }}
          >
            <Text style={styles.presetText}>1週間</Text>
          </Pressable>
          <Pressable
            style={styles.presetBtn}
            onPress={() => { setStartDate(daysAgo(30)); setEndDate(daysAgo(0)); }}
          >
            <Text style={styles.presetText}>1ヶ月</Text>
          </Pressable>
          <Pressable
            style={styles.presetBtn}
            onPress={() => { setStartDate(daysAgo(90)); setEndDate(daysAgo(0)); }}
          >
            <Text style={styles.presetText}>3ヶ月</Text>
          </Pressable>
          <Pressable
            style={styles.presetBtn}
            onPress={() => {
              const y = new Date();
              setStartDate(new Date(y.getFullYear(), 0, 1));
              setEndDate(daysAgo(0));
            }}
          >
            <Text style={styles.presetText}>今年</Text>
          </Pressable>
        </View>
      </View>

      {/* Format Selection */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>フォーマット</Text>
        <View style={styles.card}>
          <Pressable
            style={styles.formatRow}
            onPress={() => setFormat("json")}
          >
            <View style={styles.formatInfo}>
              <Text style={styles.formatName}>JSON</Text>
              <Text style={styles.formatDesc}>構造化データ、プログラム連携向け</Text>
            </View>
            <View style={[styles.radio, format === "json" && styles.radioActive]}>
              {format === "json" && <View style={styles.radioInner} />}
            </View>
          </Pressable>
          <View style={styles.divider} />
          <Pressable
            style={styles.formatRow}
            onPress={() => setFormat("csv")}
          >
            <View style={styles.formatInfo}>
              <Text style={styles.formatName}>CSV</Text>
              <Text style={styles.formatDesc}>表計算ソフト向け（Excel, スプレッドシート）</Text>
            </View>
            <View style={[styles.radio, format === "csv" && styles.radioActive]}>
              {format === "csv" && <View style={styles.radioInner} />}
            </View>
          </Pressable>
        </View>
      </View>

      {/* Export Content Preview */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>エクスポート内容</Text>
        <View style={styles.card}>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={16} color="#64748b" />
            <Text style={styles.infoText}>滞在データ（場所名、座標、時間、活動ラベル）</Text>
          </View>
          <View style={styles.divider} />
          <View style={styles.infoRow}>
            <Ionicons name="camera" size={16} color="#64748b" />
            <Text style={styles.infoText}>写真枚数（画像データは含まれません）</Text>
          </View>
        </View>
      </View>

      {/* Export Button */}
      <Pressable
        style={[styles.exportBtn, exporting && styles.exportBtnDisabled]}
        onPress={handleExport}
        disabled={exporting}
      >
        {exporting ? (
          <ActivityIndicator color="#ffffff" size="small" />
        ) : (
          <>
            <Ionicons name="share-outline" size={20} color="#ffffff" />
            <Text style={styles.exportBtnText}>エクスポート</Text>
          </>
        )}
      </Pressable>

      {/* Calendar Pickers */}
      <CalendarPicker
        visible={showStartPicker}
        selectedDate={startDate}
        onSelect={handleStartSelect}
        onClose={() => setShowStartPicker(false)}
      />
      <CalendarPicker
        visible={showEndPicker}
        selectedDate={endDate}
        onSelect={handleEndSelect}
        onClose={() => setShowEndPicker(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#f8fafc" },
  content: { paddingVertical: 16 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13, fontWeight: "600", color: "#64748b",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 8, paddingHorizontal: 16,
  },
  card: {
    backgroundColor: "#ffffff",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e2e8f0",
    marginLeft: 16,
  },
  dateRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 14, paddingHorizontal: 16,
  },
  dateLabel: { fontSize: 16, color: "#0f172a" },
  dateValue: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateText: { fontSize: 16, fontWeight: "500", fontVariant: ["tabular-nums"], color: "#3b82f6" },
  presetRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 16, marginTop: 12,
  },
  presetBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8, backgroundColor: "#f1f5f9",
  },
  presetText: { fontSize: 13, fontWeight: "500", color: "#3b82f6" },
  formatRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 14, paddingHorizontal: 16,
  },
  formatInfo: { flex: 1, marginRight: 12 },
  formatName: { fontSize: 16, fontWeight: "500", color: "#0f172a" },
  formatDesc: { fontSize: 13, color: "#94a3b8", marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: "#cbd5e1",
    justifyContent: "center", alignItems: "center",
  },
  radioActive: { borderColor: "#3b82f6" },
  radioInner: {
    width: 12, height: 12, borderRadius: 6, backgroundColor: "#3b82f6",
  },
  infoRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  infoText: { fontSize: 14, color: "#64748b", flex: 1 },
  exportBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginHorizontal: 16, paddingVertical: 16,
    backgroundColor: "#3b82f6", borderRadius: 12,
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { fontSize: 17, fontWeight: "700", color: "#ffffff" },
});
