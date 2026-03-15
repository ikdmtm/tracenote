import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";

import { initAds, warmUpInterstitial } from "@/core/monetization/adService";
import {
  initPurchases,
  checkSubscription,
  purchaseSubscription,
  restorePurchases,
  isPurchaseSdkAvailable,
} from "@/core/monetization/purchaseService";

type SubscriptionState = {
  isPro: boolean;
  loading: boolean;
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
  toggleDevPro: () => void;
};

const SubscriptionContext = createContext<SubscriptionState>({
  isPro: false,
  loading: true,
  purchase: async () => false,
  restore: async () => false,
  toggleDevPro: () => {},
});

export function SubscriptionProvider({ children }: { children: ReactNode }) {
  const [isPro, setIsPro] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const adsReady = await initAds();
      if (adsReady) warmUpInterstitial();
      const purchaseReady = await initPurchases();
      if (purchaseReady) {
        const active = await checkSubscription();
        setIsPro(active);
      }
      setLoading(false);
    })();
  }, []);

  const purchase = useCallback(async () => {
    try {
      const result = await purchaseSubscription();
      setIsPro(result);
      return result;
    } catch {
      return false;
    }
  }, []);

  const restore = useCallback(async () => {
    try {
      const result = await restorePurchases();
      setIsPro(result);
      return result;
    } catch {
      return false;
    }
  }, []);

  const toggleDevPro = useCallback(() => {
    setIsPro((prev) => !prev);
  }, []);

  return (
    <SubscriptionContext.Provider value={{ isPro, loading, purchase, restore, toggleDevPro }}>
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscription(): SubscriptionState {
  return useContext(SubscriptionContext);
}
