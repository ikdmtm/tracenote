import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Platform } from "react-native";

import i18n from "@/i18n";

export type PermissionState = "undetermined" | "foreground" | "always" | "denied";

export function useLocationPermission() {
  const [status, setStatus] = useState<PermissionState>("undetermined");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const fg = await Location.getForegroundPermissionsAsync();
      if (!fg.granted) {
        setStatus(fg.canAskAgain ? "undetermined" : "denied");
        setLoading(false);
        return;
      }

      const bg = await Location.getBackgroundPermissionsAsync();
      setStatus(bg.granted ? "always" : "foreground");
    } catch (e) {
      console.warn("[Permission] Check failed:", e);
      setStatus("undetermined");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestAlways = useCallback(async (): Promise<PermissionState> => {
    try {
      const fg = await Location.requestForegroundPermissionsAsync();
      if (!fg.granted) {
        const next = fg.canAskAgain ? "undetermined" : "denied";
        setStatus(next);
        return next;
      }

      const bg = await Location.requestBackgroundPermissionsAsync();
      if (bg.granted) {
        setStatus("always");
        return "always";
      }

      setStatus("foreground");
      return "foreground";
    } catch (e) {
      console.warn("[Permission] Request failed:", e);
      Alert.alert(
        i18n.t("permAlert.locationRequestFailedTitle"),
        Platform.select({
          ios: i18n.t("permAlert.locationRequestFailedIos"),
          default: i18n.t("permAlert.locationRequestFailedDefault"),
        }),
      );
      setStatus("denied");
      return "denied";
    }
  }, []);

  const openSettings = useCallback(() => {
    Alert.alert(
      i18n.t("permAlert.locationTitle"),
      i18n.t("permAlert.locationMsg"),
      [
        { text: i18n.t("permAlert.cancel"), style: "cancel" },
        { text: i18n.t("permAlert.openSettings"), onPress: () => Linking.openSettings() },
      ],
    );
  }, []);

  return { status, loading, requestAlways, openSettings, refresh };
}
