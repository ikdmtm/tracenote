import Constants from "expo-constants";
import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";

import { BANNER_AD_UNIT_ID } from "@/core/monetization/adService";
import { useSubscription } from "@/features/monetization/SubscriptionContext";

const isExpoGo = Constants.appOwnership === "expo";

function NativeAdBanner({ onError }: { onError: () => void }) {
  if (isExpoGo) return null;
  const { BannerAd, BannerAdSize } = require("react-native-google-mobile-ads");
  return (
    <BannerAd
      unitId={BANNER_AD_UNIT_ID}
      size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
      requestOptions={{ requestNonPersonalizedAdsOnly: true }}
      onAdFailedToLoad={onError}
    />
  );
}

export function AdBanner() {
  const { isPro, loading } = useSubscription();
  const [adError, setAdError] = useState(false);

  if (loading || isPro) return null;

  if (isExpoGo || adError) {
    return (
      <View style={styles.placeholder}>
        <Text style={styles.placeholderText}>Ad Placeholder (Dev)</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <NativeAdBanner onError={() => setAdError(true)} />
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
