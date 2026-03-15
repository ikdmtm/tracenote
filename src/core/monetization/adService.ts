import Constants from "expo-constants";
import { Platform } from "react-native";

const TEST_BANNER_IOS = "ca-app-pub-3940256099942544/2435281174";
const TEST_BANNER_ANDROID = "ca-app-pub-3940256099942544/6300978111";

export const BANNER_AD_UNIT_ID =
  Platform.OS === "ios" ? TEST_BANNER_IOS : TEST_BANNER_ANDROID;

const isExpoGo = Constants.appOwnership === "expo";

export async function initAds(): Promise<boolean> {
  if (isExpoGo) return false;
  try {
    const MobileAds = require("react-native-google-mobile-ads").default;
    await MobileAds().initialize();
    return true;
  } catch {
    return false;
  }
}

export function isAdSdkAvailable(): boolean {
  return !isExpoGo;
}
