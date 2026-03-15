import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "TraceNote",
  slug: "tracenote",
  scheme: "tracenote",
  version: "0.1.0",
  orientation: "portrait",
  newArchEnabled: true,
  android: {
    package: "com.tracenote.app",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.tracenote.app",
    infoPlist: {
      UIBackgroundModes: ["location"],
      NSLocationWhenInUseUsageDescription:
        "行動ログを自動で記録するため、位置情報を使用します。",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "アプリを開いていない時も行動ログを自動記録するため、常に位置情報を使用します。",
      NSLocationAlwaysUsageDescription:
        "行動ログを自動で記録するため、常に位置情報を使用します。",
      NSPhotoLibraryUsageDescription:
        "滞在中に撮った写真を日記に自動で紐づけるため、写真ライブラリにアクセスします。",
    },
  },
  plugins: [
    "expo-router",
    "expo-sqlite",
    "expo-font",
    [
      "expo-media-library",
      {
        photosPermission:
          "滞在中に撮った写真を日記に自動で紐づけるため、写真ライブラリにアクセスします。",
      },
    ],
  ],
};

export default config;
