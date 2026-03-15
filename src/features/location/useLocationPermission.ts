import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking } from "react-native";

export type PermissionState = "undetermined" | "foreground" | "always" | "denied";

export function useLocationPermission() {
  const [status, setStatus] = useState<PermissionState>("undetermined");
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const fg = await Location.getForegroundPermissionsAsync();
    if (!fg.granted) {
      setStatus(fg.canAskAgain ? "undetermined" : "denied");
      setLoading(false);
      return;
    }

    const bg = await Location.getBackgroundPermissionsAsync();
    setStatus(bg.granted ? "always" : "foreground");
    setLoading(false);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const requestAlways = useCallback(async (): Promise<PermissionState> => {
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
  }, []);

  const openSettings = useCallback(() => {
    Alert.alert(
      "位置情報の許可が必要です",
      "設定アプリで「常に許可」に変更してください。",
      [
        { text: "キャンセル", style: "cancel" },
        { text: "設定を開く", onPress: () => Linking.openSettings() },
      ],
    );
  }, []);

  return { status, loading, requestAlways, openSettings, refresh };
}
