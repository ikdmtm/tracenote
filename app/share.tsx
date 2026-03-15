import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, Stack } from "expo-router";
import * as Sharing from "expo-sharing";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { captureRef } from "react-native-view-shot";

import type { Stay, StayPhoto } from "@/core/domain/models";
import { getHomeLocation, refreshHomeLocation, type HomeLocation } from "@/core/engine/homeDetector";
import { getStaysByDay } from "@/core/storage/stayRepo";
import { getPhotosByStayId } from "@/core/storage/stayPhotoRepo";
import { ShareCard } from "@/features/share/ShareCard";

function parseDayKey(dayKey: string): Date {
  const [y, m, d] = dayKey.split("-").map(Number);
  return new Date(y, m - 1, d);
}

function formatTitle(date: Date): string {
  const weekdays = ["日", "月", "火", "水", "木", "金", "土"];
  return `${date.getMonth() + 1}月${date.getDate()}日（${weekdays[date.getDay()]}）`;
}

export default function ShareScreen() {
  const { dayKey } = useLocalSearchParams<{ dayKey: string }>();
  const db = useSQLiteContext();
  const cardRef = useRef<View>(null);

  const [stays, setStays] = useState<Stay[]>([]);
  const [photoMap, setPhotoMap] = useState<Record<number, StayPhoto[]>>({});
  const [home, setHome] = useState<HomeLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);

  const date = dayKey ? parseDayKey(dayKey) : new Date();

  useEffect(() => {
    (async () => {
      setLoading(true);
      const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
      const dayEnd = dayStart + 24 * 60 * 60_000;

      const [s, h] = await Promise.all([
        getStaysByDay(db, dayStart, dayEnd),
        getHomeLocation(db).then(async (cached) => {
          if (cached) return cached;
          return refreshHomeLocation(db);
        }),
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

  const handleShare = useCallback(async () => {
    if (!cardRef.current) return;
    setSharing(true);
    try {
      const uri = await captureRef(cardRef, {
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
  }, [date]);

  if (loading) {
    return (
      <>
        <Stack.Screen options={{ title: "共有", headerBackTitle: "戻る" }} />
        <View style={styles.center}>
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      </>
    );
  }

  if (stays.length === 0) {
    return (
      <>
        <Stack.Screen options={{ title: "共有", headerBackTitle: "戻る" }} />
        <View style={styles.center}>
          <Ionicons name="calendar-outline" size={48} color="#cbd5e1" />
          <Text style={styles.emptyText}>この日の滞在データがありません</Text>
        </View>
      </>
    );
  }

  return (
    <>
      <Stack.Screen options={{ title: `${formatTitle(date)}のシェア`, headerBackTitle: "戻る" }} />
      <ScrollView style={styles.container} contentContainerStyle={styles.scrollContent}>
        <Text style={styles.hint}>プレビュー</Text>

        <View style={styles.cardWrap}>
          <ShareCard
            ref={cardRef}
            date={date}
            stays={stays}
            photoMap={photoMap}
            home={home}
          />
        </View>

        <Text style={styles.note}>
          ※ 自宅と判定された滞在は「自宅」と表示され、座標は共有されません
        </Text>

        <Pressable
          style={[styles.shareBtn, sharing && styles.shareBtnDisabled]}
          onPress={handleShare}
          disabled={sharing}
        >
          {sharing ? (
            <ActivityIndicator size="small" color="#ffffff" />
          ) : (
            <>
              <Ionicons name="share-outline" size={18} color="#ffffff" />
              <Text style={styles.shareBtnText}>シェアする</Text>
            </>
          )}
        </Pressable>
      </ScrollView>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  scrollContent: {
    padding: 16,
    paddingBottom: 40,
    alignItems: "center",
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
  },
  hint: {
    fontSize: 13,
    fontWeight: "600",
    color: "#64748b",
    alignSelf: "flex-start",
    marginBottom: 12,
  },
  cardWrap: {
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 6,
    borderRadius: 20,
  },
  note: {
    fontSize: 12,
    color: "#94a3b8",
    textAlign: "center",
    marginTop: 16,
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
    paddingHorizontal: 32,
    marginTop: 20,
    width: "100%",
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
