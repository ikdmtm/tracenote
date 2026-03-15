import Constants from "expo-constants";
import { Platform } from "react-native";

/* ─── Test Ad Unit IDs (replace with production IDs later) ─── */

const TEST_BANNER_IOS = "ca-app-pub-3940256099942544/2435281174";
const TEST_BANNER_ANDROID = "ca-app-pub-3940256099942544/6300978111";
const TEST_INTERSTITIAL_IOS = "ca-app-pub-3940256099942544/4411468910";
const TEST_INTERSTITIAL_ANDROID = "ca-app-pub-3940256099942544/1033173712";

export const BANNER_AD_UNIT_ID =
  Platform.OS === "ios" ? TEST_BANNER_IOS : TEST_BANNER_ANDROID;
export const INTERSTITIAL_AD_UNIT_ID =
  Platform.OS === "ios" ? TEST_INTERSTITIAL_IOS : TEST_INTERSTITIAL_ANDROID;

const isExpoGo = Constants.appOwnership === "expo";

/* ─── SDK Init ─── */

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

/* ─── Interstitial with frequency cap ─── */

const INTERSTITIAL_COOLDOWN_MS = 3 * 60 * 1000;
let lastInterstitialShown = 0;
let interstitialAd: any = null;

function preloadInterstitial(): void {
  if (isExpoGo) return;
  try {
    const { InterstitialAd, AdEventType } = require("react-native-google-mobile-ads");
    interstitialAd = InterstitialAd.createForAdRequest(INTERSTITIAL_AD_UNIT_ID, {
      requestNonPersonalizedAdsOnly: true,
    });
    interstitialAd.addAdEventListener(AdEventType.LOADED, () => {});
    interstitialAd.addAdEventListener(AdEventType.CLOSED, () => {
      preloadInterstitial();
    });
    interstitialAd.load();
  } catch {}
}

export function warmUpInterstitial(): void {
  if (!interstitialAd) preloadInterstitial();
}

/**
 * Show an interstitial ad if cooldown has elapsed.
 * Returns true if ad was shown, false if skipped (cooldown / not loaded / Pro user).
 */
export function showInterstitialIfReady(isPro: boolean): boolean {
  if (isPro || isExpoGo) return false;

  const now = Date.now();
  if (now - lastInterstitialShown < INTERSTITIAL_COOLDOWN_MS) return false;

  if (interstitialAd?.loaded) {
    interstitialAd.show();
    lastInterstitialShown = now;
    return true;
  }

  if (!interstitialAd) preloadInterstitial();
  return false;
}
