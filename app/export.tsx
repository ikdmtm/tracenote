import { Ionicons } from "@expo/vector-icons";
import { useNavigation, useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import * as Sharing from "expo-sharing";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
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
import { showInterstitialIfReady } from "@/core/monetization/adService";
import { useTheme } from "@/features/theme/ThemeContext";
import { CalendarPicker } from "@/features/ui/CalendarPicker";
import { useSubscription } from "@/features/monetization/SubscriptionContext";

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
  const { t } = useTranslation();
  const { theme: themeColors } = useTheme();
  const db = useSQLiteContext();
  const router = useRouter();
  const navigation = useNavigation();
  const { isPro } = useSubscription();

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      showInterstitialIfReady(isPro);
    });
    return unsub;
  }, [navigation, isPro]);

  const [startDate, setStartDate] = useState(() => daysAgo(7));
  const [endDate, setEndDate] = useState(() => daysAgo(0));
  const [format, setFormat] = useState<ExportFormat>("json");
  const [exporting, setExporting] = useState(false);
  const [showStartPicker, setShowStartPicker] = useState(false);
  const [showEndPicker, setShowEndPicker] = useState(false);

  const handleExport = useCallback(async () => {
    if (startDate > endDate) {
      Alert.alert(t("export.error"), t("export.startDateBeforeEnd"));
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
        Alert.alert(t("export.done"), t("export.fileGenerated", { path: filePath }));
      }
    } catch (e) {
      Alert.alert(t("export.error"), String(e));
    } finally {
      setExporting(false);
    }
  }, [db, startDate, endDate, format, t]);

  const handleStartSelect = useCallback((d: Date) => {
    setStartDate(d);
    if (d > endDate) setEndDate(d);
  }, [endDate]);

  const handleEndSelect = useCallback((d: Date) => {
    setEndDate(d);
    if (d < startDate) setStartDate(d);
  }, [startDate]);

  return (
    <ScrollView style={[styles.container, { backgroundColor: themeColors.bg }]} contentContainerStyle={styles.content}>
      {/* Period Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("export.period")}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <Pressable style={styles.dateRow} onPress={() => setShowStartPicker(true)}>
            <Text style={[styles.dateLabel, { color: themeColors.text }]}>{t("export.startDate")}</Text>
            <View style={styles.dateValue}>
              <Text style={[styles.dateText, { color: themeColors.primary }]}>{fmtDate(startDate)}</Text>
              <Ionicons name="calendar-outline" size={18} color={themeColors.primary} />
            </View>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: themeColors.surfaceBorder }]} />
          <Pressable style={styles.dateRow} onPress={() => setShowEndPicker(true)}>
            <Text style={[styles.dateLabel, { color: themeColors.text }]}>{t("export.endDate")}</Text>
            <View style={styles.dateValue}>
              <Text style={[styles.dateText, { color: themeColors.primary }]}>{fmtDate(endDate)}</Text>
              <Ionicons name="calendar-outline" size={18} color={themeColors.primary} />
            </View>
          </Pressable>
        </View>

        {/* Quick Presets */}
        <View style={styles.presetRow}>
          <Pressable
            style={[styles.presetBtn, { backgroundColor: themeColors.divider }]}
            onPress={() => { setStartDate(daysAgo(7)); setEndDate(daysAgo(0)); }}
          >
            <Text style={[styles.presetText, { color: themeColors.primary }]}>{t("export.oneWeek")}</Text>
          </Pressable>
          <Pressable
            style={[styles.presetBtn, { backgroundColor: themeColors.divider }]}
            onPress={() => { setStartDate(daysAgo(30)); setEndDate(daysAgo(0)); }}
          >
            <Text style={[styles.presetText, { color: themeColors.primary }]}>{t("export.oneMonth")}</Text>
          </Pressable>
          <Pressable
            style={[styles.presetBtn, { backgroundColor: themeColors.divider }]}
            onPress={() => { setStartDate(daysAgo(90)); setEndDate(daysAgo(0)); }}
          >
            <Text style={[styles.presetText, { color: themeColors.primary }]}>{t("export.threeMonths")}</Text>
          </Pressable>
          <Pressable
            style={[styles.presetBtn, { backgroundColor: themeColors.divider }]}
            onPress={() => {
              const y = new Date();
              setStartDate(new Date(y.getFullYear(), 0, 1));
              setEndDate(daysAgo(0));
            }}
          >
            <Text style={[styles.presetText, { color: themeColors.primary }]}>{t("export.thisYear")}</Text>
          </Pressable>
        </View>
      </View>

      {/* Format Selection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("export.format")}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <Pressable
            style={styles.formatRow}
            onPress={() => setFormat("json")}
          >
            <View style={styles.formatInfo}>
              <Text style={[styles.formatName, { color: themeColors.text }]}>JSON</Text>
              <Text style={[styles.formatDesc, { color: themeColors.textMuted }]}>{t("export.jsonDesc")}</Text>
            </View>
            <View style={[styles.radio, { borderColor: format === "json" ? themeColors.primary : themeColors.surfaceBorder }]}>
              {format === "json" && <View style={[styles.radioInner, { backgroundColor: themeColors.primary }]} />}
            </View>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: themeColors.surfaceBorder }]} />
          <Pressable
            style={styles.formatRow}
            onPress={() => setFormat("csv")}
          >
            <View style={styles.formatInfo}>
              <Text style={[styles.formatName, { color: themeColors.text }]}>CSV</Text>
              <Text style={[styles.formatDesc, { color: themeColors.textMuted }]}>{t("export.csvDesc")}</Text>
            </View>
            <View style={[styles.radio, { borderColor: format === "csv" ? themeColors.primary : themeColors.surfaceBorder }]}>
              {format === "csv" && <View style={[styles.radioInner, { backgroundColor: themeColors.primary }]} />}
            </View>
          </Pressable>
        </View>
      </View>

      {/* Export Content Preview */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>エクスポート内容</Text>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <View style={styles.infoRow}>
            <Ionicons name="location" size={16} color={themeColors.textSecondary} />
            <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>滞在データ（場所名、座標、時間、活動ラベル）</Text>
          </View>
          <View style={[styles.divider, { backgroundColor: themeColors.surfaceBorder }]} />
          <View style={styles.infoRow}>
            <Ionicons name="camera" size={16} color={themeColors.textSecondary} />
            <Text style={[styles.infoText, { color: themeColors.textSecondary }]}>写真枚数（画像データは含まれません）</Text>
          </View>
        </View>
      </View>

      {/* Export Button */}
      <Pressable
        style={[styles.exportBtn, { backgroundColor: themeColors.primary }, exporting && styles.exportBtnDisabled]}
        onPress={handleExport}
        disabled={exporting}
      >
        {exporting ? (
          <ActivityIndicator color={themeColors.textOnPrimary} size="small" />
        ) : (
          <>
            <Ionicons name="share-outline" size={20} color={themeColors.textOnPrimary} />
            <Text style={[styles.exportBtnText, { color: themeColors.textOnPrimary }]}>{t("export.exportBtn")}</Text>
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
  container: { flex: 1 },
  content: { paddingVertical: 16 },
  section: { marginBottom: 24 },
  sectionTitle: {
    fontSize: 13, fontWeight: "600",
    textTransform: "uppercase", letterSpacing: 0.5,
    marginBottom: 8, paddingHorizontal: 16,
  },
  card: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: 16,
  },
  dateRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 14, paddingHorizontal: 16,
  },
  dateLabel: { fontSize: 16 },
  dateValue: { flexDirection: "row", alignItems: "center", gap: 8 },
  dateText: { fontSize: 16, fontWeight: "500", fontVariant: ["tabular-nums"] },
  presetRow: {
    flexDirection: "row", gap: 8,
    paddingHorizontal: 16, marginTop: 12,
  },
  presetBtn: {
    paddingHorizontal: 14, paddingVertical: 8,
    borderRadius: 8,
  },
  presetText: { fontSize: 13, fontWeight: "500" },
  formatRow: {
    flexDirection: "row", justifyContent: "space-between",
    alignItems: "center", paddingVertical: 14, paddingHorizontal: 16,
  },
  formatInfo: { flex: 1, marginRight: 12 },
  formatName: { fontSize: 16, fontWeight: "500" },
  formatDesc: { fontSize: 13, marginTop: 2 },
  radio: {
    width: 22, height: 22, borderRadius: 11,
    borderWidth: 2,
    justifyContent: "center", alignItems: "center",
  },
  radioInner: {
    width: 12, height: 12, borderRadius: 6,
  },
  infoRow: {
    flexDirection: "row", alignItems: "center", gap: 10,
    paddingVertical: 12, paddingHorizontal: 16,
  },
  infoText: { fontSize: 14, flex: 1 },
  exportBtn: {
    flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8,
    marginHorizontal: 16, paddingVertical: 16,
    borderRadius: 12,
  },
  exportBtnDisabled: { opacity: 0.6 },
  exportBtnText: { fontSize: 17, fontWeight: "700" },
});
