import { Platform } from "react-native";

const REVENUECAT_IOS_KEY = "";
const REVENUECAT_ANDROID_KEY = "";
const ENTITLEMENT_ID = "pro";

let sdkAvailable: boolean | null = null;
let Purchases: any = null;

function loadSdk(): boolean {
  if (sdkAvailable !== null) return sdkAvailable;
  try {
    Purchases = require("react-native-purchases").default;
    sdkAvailable = true;
  } catch {
    sdkAvailable = false;
  }
  return sdkAvailable;
}

export async function initPurchases(): Promise<boolean> {
  if (!loadSdk()) return false;
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
  if (!loadSdk() || !Purchases) return false;
  try {
    const info = await Purchases.getCustomerInfo();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}

export async function purchaseSubscription(): Promise<boolean> {
  if (!loadSdk() || !Purchases) return false;
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
  if (!loadSdk() || !Purchases) return false;
  try {
    const info = await Purchases.restorePurchases();
    return info.entitlements.active[ENTITLEMENT_ID] !== undefined;
  } catch {
    return false;
  }
}

export function isPurchaseSdkAvailable(): boolean {
  return loadSdk();
}
