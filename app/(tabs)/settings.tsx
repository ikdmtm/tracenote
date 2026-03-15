import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
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
import i18n, { setAppLanguage } from "@/i18n";
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

type LangValue = "ja" | "en";

export default function SettingsScreen() {
  const db = useSQLiteContext();
  const router = useRouter();
  const { t } = useTranslation();
  const { theme: themeColors, themeId, setThemeId } = useTheme();

  const [lang, setLang] = useState<LangValue>(i18n.language as LangValue);
  const [dayEndTime, setDayEndTime] = useState<string>("03:00");
  const [excludeScreenshots, setExcludeScreenshots] = useState(true);
  const [homeLocation, setHomeLocation] = useState<HomeLocation | null>(null);
  const { status: photoStatus, request: requestPhotoPermission, openSettings: openPhotoSettings } = usePhotoPermission();
  const { isPro, purchase, restore, toggleDevPro } = useSubscription();

  useEffect(() => {
    (async () => {
      const l = await getSetting(db, "language");
      if (l === "ja" || l === "en") {
        setLang(l);
        setAppLanguage(l);
      }
      const de = await getSetting(db, "day_end_time");
      if (de) setDayEndTime(de);
      const es = await getSetting(db, "exclude_screenshots");
      setExcludeScreenshots(es !== "false");
      const h = await getHomeLocation(db);
      setHomeLocation(h);
    })();
  }, [db]);

  const handleLangChange = useCallback(
    async (next: LangValue) => {
      setLang(next);
      await setSetting(db, "language", next);
      setAppLanguage(next);
    },
    [db],
  );

  const updateDayEndTime = useCallback(
    async (next: string) => {
      setDayEndTime(next);
      await setSetting(db, "day_end_time", next);
    },
    [db],
  );

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: themeColors.bg }]}
      contentContainerStyle={styles.content}
    >
      {/* Language Selector */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("settings.language")}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          {(["ja", "en"] as const).map((opt, idx) => (
            <View key={opt}>
              {idx > 0 && <View style={[styles.divider, { backgroundColor: themeColors.surfaceBorder }]} />}
              <Pressable
                style={styles.menuRow}
                onPress={() => handleLangChange(opt)}
              >
                <Text style={[styles.menuLabel, { color: themeColors.text }]}>
                  {opt === "ja" ? t("settings.langJa") : t("settings.langEn")}
                </Text>
                {lang === opt && <Ionicons name="checkmark-circle" size={20} color={themeColors.primary} />}
              </Pressable>
            </View>
          ))}
        </View>
      </View>

      {/* Theme Selector */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("settings.theme")}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <View style={styles.themeRow}>
            {THEME_LIST.map((th) => {
              const selected = themeId === th.id;
              return (
                <Pressable
                  key={th.id}
                  style={[
                    styles.themeOption,
                    selected && { borderColor: themeColors.primary },
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
                    { color: selected ? themeColors.primary : themeColors.textSecondary },
                    selected && { fontWeight: "700" },
                  ]}>{t(`themeName.${th.id}`)}</Text>
                  {selected && (
                    <Ionicons name="checkmark-circle" size={16} color={themeColors.primary} />
                  )}
                </Pressable>
              );
            })}
          </View>
        </View>
      </View>

      {/* Time Settings */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("settings.timeSettings")}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: themeColors.text }]}>{t("settings.activityEnd")}</Text>
              <Text style={[styles.settingDescription, { color: themeColors.textMuted }]}>{t("settings.dayCutoff")}</Text>
            </View>
            <View style={styles.timePickerRow}>
              <View style={styles.timeUnit}>
                <Pressable style={styles.arrowButton} onPress={() => updateDayEndTime(cycleHour(dayEndTime, 1))}>
                  <Ionicons name="chevron-up" size={18} color={themeColors.textSecondary} />
                </Pressable>
                <Text style={[styles.timeText, { color: themeColors.text }]}>{String(parseTime(dayEndTime).h).padStart(2, "0")}</Text>
                <Pressable style={styles.arrowButton} onPress={() => updateDayEndTime(cycleHour(dayEndTime, -1))}>
                  <Ionicons name="chevron-down" size={18} color={themeColors.textSecondary} />
                </Pressable>
              </View>
              <Text style={[styles.timeSeparator, { color: themeColors.text }]}>:</Text>
              <View style={styles.timeUnit}>
                <Pressable style={styles.arrowButton} onPress={() => updateDayEndTime(cycleMinute(dayEndTime, 15))}>
                  <Ionicons name="chevron-up" size={18} color={themeColors.textSecondary} />
                </Pressable>
                <Text style={[styles.timeText, { color: themeColors.text }]}>{String(parseTime(dayEndTime).m).padStart(2, "0")}</Text>
                <Pressable style={styles.arrowButton} onPress={() => updateDayEndTime(cycleMinute(dayEndTime, -15))}>
                  <Ionicons name="chevron-down" size={18} color={themeColors.textSecondary} />
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </View>

      {/* Permissions */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("settings.permissions")}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <View style={styles.menuRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: themeColors.text }]}>{t("settings.photoAccess")}</Text>
              <Text style={[styles.settingDescription, { color: themeColors.textMuted }]}>
                {t("settings.photoAccessDesc")}
              </Text>
            </View>
            {photoStatus === "granted" ? (
              <View style={[styles.permBadge, { backgroundColor: "#dcfce7" }]}>
                <Text style={[styles.permBadgeText, { color: themeColors.success }]}>{t("settings.permGranted")}</Text>
              </View>
            ) : photoStatus === "limited" ? (
              <Pressable style={[styles.permBadge, { backgroundColor: "#fef3c7" }]} onPress={openPhotoSettings}>
                <Text style={[styles.permBadgeText, { color: themeColors.warning }]}>{t("settings.permPartial")}</Text>
              </Pressable>
            ) : photoStatus === "denied" ? (
              <Pressable style={[styles.permBadge, { backgroundColor: "#fee2e2" }]} onPress={openPhotoSettings}>
                <Text style={[styles.permBadgeText, { color: themeColors.danger }]}>{t("settings.permDenied")}</Text>
              </Pressable>
            ) : (
              <Pressable style={[styles.permBadge, { backgroundColor: themeColors.primaryLight }]} onPress={requestPhotoPermission}>
                <Text style={[styles.permBadgeText, { color: themeColors.primary }]}>{t("settings.permGrant")}</Text>
              </Pressable>
            )}
          </View>
          <View style={[styles.divider, { backgroundColor: themeColors.surfaceBorder }]} />
          <View style={styles.menuRow}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.menuLabel, { color: themeColors.text }]}>{t("settings.excludeScreenshots")}</Text>
              <Text style={[styles.settingDescription, { color: themeColors.textMuted }]}>
                {t("settings.excludeScreenshotsDesc")}
              </Text>
            </View>
            <Switch
              value={excludeScreenshots}
              onValueChange={async (val) => {
                setExcludeScreenshots(val);
                await setSetting(db, "exclude_screenshots", val ? "true" : "false");
              }}
              trackColor={{ false: themeColors.surfaceBorder, true: themeColors.switchTrack }}
              thumbColor={excludeScreenshots ? themeColors.primary : "#f4f4f5"}
            />
          </View>
        </View>
      </View>

      {/* Data */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("settings.data")}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <Pressable style={styles.menuRow} onPress={() => router.push("/export")}>
            <Text style={[styles.menuLabel, { color: themeColors.text }]}>{t("settings.export")}</Text>
            <Ionicons name="chevron-forward" size={20} color={themeColors.textMuted} />
          </Pressable>
        </View>
      </View>

      {/* Home Detection */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("settings.homeDetection")}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <View style={styles.menuRow}>
            <Text style={[styles.menuLabel, { color: themeColors.text }]}>{t("settings.homeStatus")}</Text>
            <Text style={[styles.menuValue, { color: themeColors.textMuted }]}>
              {homeLocation
                ? t("settings.homeDetectedWithCoords", { lat: homeLocation.lat.toFixed(3), lng: homeLocation.lng.toFixed(3) })
                : t("settings.homeNotDetectedAccumulating")}
            </Text>
          </View>
          <View style={[styles.divider, { backgroundColor: themeColors.surfaceBorder }]} />
          <Pressable
            style={styles.menuRow}
            onPress={async () => {
              const h = await refreshHomeLocation(db);
              setHomeLocation(h);
              Alert.alert(
                t("settings.homeDetection"),
                h ? t("settings.homeReDetectSuccess", { count: h.count }) : t("settings.homeReDetectNotEnough"),
              );
            }}
          >
            <Text style={[styles.menuLabel, { color: themeColors.primary }]}>{t("settings.homeReDetect")}</Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: themeColors.surfaceBorder }]} />
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              Alert.alert(t("settings.homeResetButton"), t("settings.homeResetConfirm"), [
                { text: t("settings.cancel"), style: "cancel" },
                {
                  text: t("settings.homeReset"),
                  style: "destructive",
                  onPress: async () => {
                    await setSetting(db, "home_location", "");
                    setHomeLocation(null);
                  },
                },
              ])
            }
          >
            <Text style={[styles.menuLabel, { color: themeColors.danger }]}>{t("settings.homeResetButton")}</Text>
          </Pressable>
        </View>
      </View>

      {/* Subscription */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("settings.subscription")}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <View style={styles.menuRow}>
            <Text style={[styles.menuLabel, { color: themeColors.text }]}>{t("settings.plan")}</Text>
            <View style={[styles.permBadge, { backgroundColor: isPro ? themeColors.primaryLight : themeColors.divider }]}>
              <Text style={[styles.permBadgeText, { color: isPro ? themeColors.primary : themeColors.textSecondary }]}>
                {isPro ? t("settings.proWithAds") : t("settings.freeWithAds")}
              </Text>
            </View>
          </View>
          {!isPro && (
            <>
              <View style={[styles.divider, { backgroundColor: themeColors.surfaceBorder }]} />
              <Pressable
                style={styles.menuRow}
                onPress={async () => {
                  try {
                    const ok = await purchase();
                    Alert.alert(
                      ok ? t("settings.thanks") : t("settings.purchase"),
                      ok ? t("settings.purchaseSuccess") : t("settings.purchaseCancelled"),
                    );
                  } catch (e) {
                    Alert.alert(t("settings.error"), String(e));
                  }
                }}
              >
                <Text style={[styles.menuLabel, { color: themeColors.primary }]}>{t("settings.upgrade")}</Text>
              </Pressable>
            </>
          )}
          <View style={[styles.divider, { backgroundColor: themeColors.surfaceBorder }]} />
          <Pressable
            style={styles.menuRow}
            onPress={async () => {
              try {
                const ok = await restore();
                Alert.alert(t("settings.restoreTitle"), ok ? t("settings.restoreSuccess") : t("settings.restoreNotFound"));
              } catch (e) {
                Alert.alert(t("settings.error"), String(e));
              }
            }}
          >
            <Text style={[styles.menuLabel, { color: themeColors.text }]}>{t("settings.restore")}</Text>
          </Pressable>
          {__DEV__ && (
            <>
              <View style={[styles.divider, { backgroundColor: themeColors.surfaceBorder }]} />
              <View style={styles.menuRow}>
                <Text style={[styles.menuLabel, { color: themeColors.warning }]}>🛠 {t("settings.devProToggle")}</Text>
                <Switch value={isPro} onValueChange={toggleDevPro} />
              </View>
            </>
          )}
        </View>
      </View>

      {/* Debug */}
      <View style={styles.section}>
        <Text style={[styles.sectionTitle, { color: themeColors.textSecondary }]}>{t("settings.debug")}</Text>
        <View style={[styles.card, { backgroundColor: themeColors.surface, borderColor: themeColors.surfaceBorder }]}>
          <Pressable
            style={styles.menuRow}
            onPress={async () => {
              try {
                const result = await seedTestDay(db, 0);
                Alert.alert(t("settings.seedTestDone"), t("settings.seedTestResultToday", { events: result.events, stays: result.stays }));
              } catch (e) {
                Alert.alert(t("settings.error"), String(e));
              }
            }}
          >
            <Text style={[styles.menuLabel, { color: themeColors.text }]}>{t("settings.seedTestToday")}</Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: themeColors.surfaceBorder }]} />
          <Pressable
            style={styles.menuRow}
            onPress={async () => {
              try {
                const r0 = await seedTestDay(db, 1);
                const r1 = await seedTestDay(db, 2);
                Alert.alert(
                  t("settings.seedTestDone"),
                  t("settings.seedTestResultPast", {
                    r0events: r0.events,
                    r0stays: r0.stays,
                    r1events: r1.events,
                    r1stays: r1.stays,
                  }),
                );
              } catch (e) {
                Alert.alert(t("settings.error"), String(e));
              }
            }}
          >
            <Text style={[styles.menuLabel, { color: themeColors.text }]}>{t("settings.seedTestTwoDays")}</Text>
          </Pressable>
          <View style={[styles.divider, { backgroundColor: themeColors.surfaceBorder }]} />
          <Pressable
            style={styles.menuRow}
            onPress={() =>
              Alert.alert(t("settings.deleteAllTitle"), t("settings.deleteAllConfirmMsg"), [
                { text: t("settings.cancel"), style: "cancel" },
                {
                  text: t("settings.delete"),
                  style: "destructive",
                  onPress: async () => {
                    await clearAllData(db);
                    Alert.alert(t("settings.deleteAllDone"), t("settings.deleteAllSuccess"));
                  },
                },
              ])
            }
          >
            <Text style={[styles.menuLabel, { color: themeColors.danger }]}>{t("settings.deleteAll")}</Text>
          </Pressable>
        </View>
      </View>

      <Text style={[styles.version, { color: themeColors.textMuted }]}>TraceNote v0.1.0</Text>
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
