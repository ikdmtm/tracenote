import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "TraceNote",
  slug: "tracenote",
  scheme: "tracenote",
  version: "0.1.0",
  orientation: "portrait",
  newArchEnabled: true,
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
    },
  },
  plugins: [
    "expo-router",
    "expo-sqlite",
    "expo-font",
  ],
};

export default config;
