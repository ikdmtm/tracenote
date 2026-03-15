import Constants from "expo-constants";
import { Platform } from "react-native";

const REVENUECAT_IOS_KEY = "";
const REVENUECAT_ANDROID_KEY = "";
const ENTITLEMENT_ID = "pro";

const isExpoGo = Constants.appOwnership === "expo";

function getPurchases(): any {
  if (isExpoGo) return null;
  try {
    return require("react-native-purchases").default;
  } catch {
    return null;
  }
}

export async function initPurchases(): Promise<boolean> {
  const Purchases = getPurchases();
  if (!Purchases) return false;
  const apiKey = Platform.OS === "ios" ? REVENUECAT_IOS_KEY : REVENUECAT_ANDROID_KEY;
  if (!apiKey) {
    console.log("[Purchases] No API key configured, running in free mode");
    return false;
  }
  try {
    Purchases.configure({ apiKey });
    return true;
  } catch (e) {
    console.warn("[Purchases] Configure failed:", e);
    return false;
  }
}

export async function checkSubscription(): Promise<boolean> {
  const Purchases = getPurchases();
  if (!Purchases) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}

export async function purchaseSubscription(): Promise<boolean> {
  const Purchases = getPurchases();
  if (!Purchases) return false;
  try {
    const offerings = await Purchases.getOfferings();
    const pkg = offerings.current?.availablePackages?.[0];
    if (!pkg) throw new Error("No packages available");
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch (e: any) {
    if (e.userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const Purchases = getPurchases();
  if (!Purchases) return false;
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}

export function isPurchaseSdkAvailable(): boolean {
  return !isExpoGo;
}
