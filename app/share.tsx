import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useNavigation, useRouter, Stack } from "expo-router";
import * as Sharing from "expo-sharing";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";

import type { Stay, StayPhoto } from "@/core/domain/models";
import { showInterstitialIfReady } from "@/core/monetization/adService";
import { distanceM } from "@/core/engine/geo";
import {
  getHomeLocation,
  refreshHomeLocation,
  type HomeLocation,
} from "@/core/engine/homeDetector";
import { getStaysByDay } from "@/core/storage/stayRepo";
import { getPhotosByStayId } from "@/core/storage/stayPhotoRepo";
import { useSubscription } from "@/features/monetization/SubscriptionContext";
import {
  ShareCardPage,
  splitIntoPages,
} from "@/features/share/ShareCard";

const SCREEN_W = Dimensions.get("window").width;

function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatTitle(date: Date): string {
  const wd = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}月${date.getDate()}日（${wd[date.getDay()]}）`;
}

export default function ShareScreen() {
  const { dayKey } = useLocalSearchParams<{ dayKey: string }>();
  const db = useSQLiteContext();
  const router = useRouter();
  const navigation = useNavigation();
  const { isPro } = useSubscription();

  useEffect(() => {
    const unsub = navigation.addListener("beforeRemove", () => {
      showInterstitialIfReady(isPro);
    });
    return unsub;
  }, [navigation, isPro]);

  const [stays, setStays] = useState<Stay[]>([]);
  const [photoMap, setPhotoMap] = useState<Record<number, StayPhoto[]>>({});
  const [home, setHome] = useState<HomeLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const [currentPage, setCurrentPage] = useState(0);

  const pageRefs = useRef<(View | null)[]>([]);

  const date = dayKey ? parseDayKey(dayKey) : new Date();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60_000;

      const [s, h] = await Promise.all([
        getStaysByDay(db, dayStart, dayEnd),
        getHomeLocation(db).then(async (cached) => cached ?? refreshHomeLocation(db)),
      ]);

      setStays(s);
      setHome(h);

      const pMap: Record<number, StayPhoto[]> = {};
      for (const st of s) {
        const photos = await getPhotosByStayId(db, st.id);
        if (photos.length > 0) pMap[st.id] = photos;
      }
      setPhotoMap(pMap);
      setLoading(false);
    })();
  }, [db, dayKey]);

  const pages = splitIntoPages(stays);

  const totalDistanceM = (() => {
    let total = 0;
    for (let i = 0; i < stays.length - 1; i++) {
      total += distanceM(
        stays[i].lat, stays[i].lng,
        stays[i + 1].lat, stays[i + 1].lng,
      );
    }
    return Math.round(total);
  })();

  const totalPhotos = stays.reduce(
    (sum, s) => sum + (photoMap[s.id]?.length ?? 0), 0,
  );

  const handleShareCurrent = useCallback(async () => {
    const ref = pageRefs.current[currentPage];
    if (!ref) return;
    setSharing(true);
    try {
      const uri = await captureRef(ref, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert("共有できません", "この端末では共有機能が利用できません。");
        return;
      }
      await Sharing.shareAsync(uri, {
        mimeType: "image/png",
        dialogTitle: `TraceNote - ${formatTitle(date)}`,
      });
    } catch (e: any) {
      if (e?.message?.includes("User did not share")) return;
      console.warn("[Share] Error:", e);
      Alert.alert("エラー", "画像の生成に失敗しました");
    } finally {
      setSharing(false);
    }
  }, [currentPage, date]);

  const closeBtn = useCallback(
    () => (
      <Pressable onPress={() => router.back()} hitSlop={8}>
        <Ionicons name="close" size={24} color="#64748b" />
      </Pressable>
    ),
    [router],
  );

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "共有", headerBackTitle: "戻る", headerRight: closeBtn }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </>
    );
  }

  if (pages.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: "共有", headerBackTitle: "戻る", headerRight: closeBtn }} />
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>この日の共有できる滞在データがありません</Text>
        </View>
      </>
    );
  }

  const onScroll = (e: any) => {
    const pageW = e.nativeEvent.layoutMeasurement.width;
    const idx = Math.round(e.nativeEvent.contentOffset.x / pageW);
    setCurrentPage(idx);
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: `${formatTitle(date)}のシェア`,
          headerBackTitle: "戻る",
          headerRight: closeBtn,
        }}
      />
      <View style={styles.container}>
        <Text style={styles.hint}>
          {pages.length > 1
            ? `${pages.length}ページ — 左右にスワイプ`
            : "プレビュー"}
        </Text>

        {/* Page pager */}
        <FlatList
          data={pages}
          keyExtractor={(_, i) => String(i)}
          horizontal
          pagingEnabled
          showsHorizontalScrollIndicator={false}
          onScroll={onScroll}
          scrollEventThrottle={200}
          contentContainerStyle={styles.pagerContent}
          renderItem={({ item, index }) => (
            <View style={styles.pageWrap}>
              <View style={styles.cardShadow}>
                <ShareCardPage
                  ref={(el) => { pageRefs.current[index] = el; }}
                  date={date}
                  page={item}
                  photoMap={photoMap}
                  home={home}
                  totalStays={stays.length}
                  totalDistanceM={totalDistanceM}
                  totalPhotos={totalPhotos}
                />
              </View>
            </View>
          )}
        />

        {/* Page dots */}
        {pages.length > 1 && (
          <View style={styles.dotsRow}>
            {pages.map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === currentPage && styles.dotActive]}
              />
            ))}
          </View>
        )}

        <Text style={styles.note}>
          ※ 座標・住所は画像に含まれません{"\n"}
          自宅は「自宅」とのみ表示されます
        </Text>

        <Pressable
          style={[styles.shareBtn, sharing && styles.shareBtnDisabled]}
          onPress={handleShareCurrent}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="share-outline" size={18} color="#ffffff" />
              <Text style={styles.shareBtnText}>
                {pages.length > 1
                  ? `ページ ${currentPage + 1} をシェア`
                  : "シェアする"}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </>
  );
}

const CARD_PREVIEW_W = 1080 * 0.3;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    gap: 12,
  },
  emptyText: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
  },
  hint: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    textAlign: "center",
    marginTop: 12,
    marginBottom: 10,
  },
  pagerContent: {
    paddingHorizontal: (SCREEN_W - CARD_PREVIEW_W) / 2,
  },
  pageWrap: {
    width: CARD_PREVIEW_W,
    alignItems: "center",
  },
  cardShadow: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderRadius: 16,
  },
  dotsRow: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    marginTop: 12,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: "#cbd5e1",
  },
  dotActive: {
    backgroundColor: "#3b82f6",
    width: 18,
  },
  note: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 12,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#3b82f6",
    borderRadius: 12,
    paddingVertical: 14,
    marginHorizontal: 20,
    marginTop: 12,
    marginBottom: 24,
  },
  shareBtnDisabled: {
    opacity: 0.6,
  },
  shareBtnText: {
    fontSize: 16,
    fontWeight: "600",
    color: "#ffffff",
  },
});
