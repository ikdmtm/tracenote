import * as MediaLibrary from "expo-media-library";
import { useCallback, useEffect, useState } from "react";
import { Alert, Linking } from "react-native";

export type PhotoPermissionState = "undetermined" | "granted" | "limited" | "denied";

function mapStatus(status: MediaLibrary.PermissionStatus): PhotoPermissionState {
  switch (status) {
    case MediaLibrary.PermissionStatus.GRANTED:
      return "granted";
    case MediaLibrary.PermissionStatus.DENIED:
      return "denied";
    case MediaLibrary.PermissionStatus.UNDETERMINED:
    default:
      return "undetermined";
  }
}

export function usePhotoPermission() {
  const [status, setStatus] = useState<PhotoPermissionState>("undetermined");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { status: s, accessPrivileges } = await MediaLibrary.getPermissionsAsync();
        if (accessPrivileges === "limited") {
          setStatus("limited");
        } else {
          setStatus(mapStatus(s));
        }
      } catch {
        setStatus("undetermined");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const request = useCallback(async (): Promise<PhotoPermissionState> => {
    try {
      const { status: s, accessPrivileges } = await MediaLibrary.requestPermissionsAsync();
      let result: PhotoPermissionState;
      if (accessPrivileges === "limited") {
        result = "limited";
      } else {
        result = mapStatus(s);
      }
      setStatus(result);
      return result;
    } catch {
      setStatus("denied");
      return "denied";
    }
  }, []);

  const openSettings = useCallback(() => {
    Alert.alert(
      "写真アクセスが必要です",
      "設定アプリで写真へのアクセスを許可してください。",
      [
        { text: "キャンセル", style: "cancel" },
        { text: "設定を開く", onPress: () => Linking.openSettings() },
      ],
    );
  }, []);

  return { status, loading, request, openSettings };
}
