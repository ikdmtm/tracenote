import * as Location from "expo-location";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking, Platform } from "react-native";

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
        "位置情報の許可に失敗しました",
        Platform.select({
          ios: "開発ビルド（Dev Client）では位置情報が利用できます。Expo Goでは制限がある場合があります。",
          default: "位置情報のパーミッションリクエストに失敗しました。",
        }),
      );
      setStatus("denied");
      return "denied";
    }
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
