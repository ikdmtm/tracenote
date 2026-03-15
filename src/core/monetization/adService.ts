import { Platform } from "react-native";

const TEST_BANNER_IOS = "ca-app-pub-3940256099942544/2435281174";
const TEST_BANNER_ANDROID = "ca-app-pub-3940256099942544/6300978111";

export const BANNER_AD_UNIT_ID =
  Platform.OS === "ios" ? TEST_BANNER_IOS : TEST_BANNER_ANDROID;

let sdkAvailable: boolean | null = null;

function tryRequire(id: string): any {
  try {
    return require(id);
  } catch {
    return null;
  }
}

const AD_MODULE_ID = "react-native-google-mobile-ads";

export async function initAds(): Promise<boolean> {
  try {
    const mod = tryRequire(AD_MODULE_ID);
    if (!mod?.default) { sdkAvailable = false; return false; }
    await mod.default().initialize();
    sdkAvailable = true;
    return true;
  } catch {
    sdkAvailable = false;
    return false;
  }
}

export function isAdSdkAvailable(): boolean {
  if (sdkAvailable !== null) return sdkAvailable;
  sdkAvailable = !!tryRequire(AD_MODULE_ID);
  return sdkAvailable;
}
