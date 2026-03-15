import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { isAdSdkAvailable, BANNER_AD_UNIT_ID } from "@/core/monetization/adService";
import { useSubscription } from "@/features/monetization/SubscriptionContext";

const AD_MODULE_ID = "react-native-google-mobile-ads";

function tryRequire(id: string): any {
  try {
    return require(id);
  } catch {
    return null;
  }
}

export function AdBanner() {
  const { isPro, loading } = useSubscription();
  const [adError, setAdError] = useState(false);

  if (loading || isPro) return null;

  if (!isAdSdkAvailable()) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Ad Placeholder (Dev)</Text>
      </View>
    );
  }

  const mod = tryRequire(AD_MODULE_ID);
  if (!mod) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Ad Placeholder (Dev)</Text>
      </View>
    );
  }

  const { BannerAd, BannerAdSize } = mod;

  if (adError || !BannerAd) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Ad</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <BannerAd
        unitId={BANNER_AD_UNIT_ID}
        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
        requestOptions={{ requestNonPersonalizedAdsOnly: true }}
        onAdFailedToLoad={() => setAdError(true)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: "center",
    paddingVertical: 4,
    backgroundColor: "#f8fafc",
  },
  placeholder: {
    height: 52,
    backgroundColor: "#f1f5f9",
    borderTopWidth: StyleSheet.hairlineWidth,
    borderColor: "#e2e8f0",
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 11,
    color: "#94a3b8",
  },
});
