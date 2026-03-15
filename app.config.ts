import type { ExpoConfig } from "expo/config";

const config: ExpoConfig = {
  name: "TraceNote",
  slug: "tracenote",
  scheme: "tracenote",
  version: "0.1.0",
  orientation: "portrait",
  newArchEnabled: true,
  locales: {
    ja: "./locales/ja.json",
    en: "./locales/en.json",
  },
  android: {
    package: "com.tracenote.app",
  },
  ios: {
    supportsTablet: false,
    bundleIdentifier: "com.tracenote.app",
    infoPlist: {
      UIBackgroundModes: ["location"],
      NSLocationWhenInUseUsageDescription:
        "Your location is used to automatically record your activity log.",
      NSLocationAlwaysAndWhenInUseUsageDescription:
        "Your location is always used to automatically record your activity log, even when the app is not open.",
      NSLocationAlwaysUsageDescription:
        "Your location is always used to automatically record your activity log.",
      NSPhotoLibraryUsageDescription:
        "Your photo library is accessed to automatically link photos taken during stays.",
    },
  },
  plugins: [
    "expo-router",
    "expo-sqlite",
    "expo-font",
    "expo-localization",
    [
      "expo-location",
      { locationAlwaysAndWhenInUsePermission: "Your location is always used to automatically record your activity log, even when the app is not open." },
    ],
    [
      "expo-media-library",
      { photosPermission: "Your photo library is accessed to automatically link photos taken during stays." },
    ],
    [
      "react-native-google-mobile-ads",
      { androidAppId: "ca-app-pub-3940256099942544~3347511713", iosAppId: "ca-app-pub-3940256099942544~1458002511" },
    ],
  ],
};

export default config;
