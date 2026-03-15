import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { RawEvent, Stay, StayPhoto } from "@/core/domain/models";
import { getLatestRawEvents } from "@/core/storage/rawEventRepo";
import { getTodayStays } from "@/core/storage/stayRepo";
import { getPhotosByStayId } from "@/core/storage/stayPhotoRepo";
import { StayCard } from "@/features/stays/StayCard";

type ViewMode = "stays" | "raw";

function formatTs(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function RawEventRow({ item }: { item: RawEvent }) {
  return (
    <View style={styles.rawRow}>
      <View style={styles.rawLeft}>
        <Text style={styles.rawTime}>{formatTs(item.ts)}</Text>
        <Text style={styles.rawCoord}>
          {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
        </Text>
      </View>
      <View style={styles.rawRight}>
        <Text style={styles.rawAcc}>±{Math.round(item.acc)}m</Text>
        <Text style={styles.rawSource}>{item.source}</Text>
      </View>
    </View>
  );
}

const PAGE_SIZE = 100;

export default function TimelineScreen() {
  const db = useSQLiteContext();
  const [mode, setMode] = useState<ViewMode>("stays");
  const [stays, setStays] = useState<Stay[]>([]);
  const [photoMap, setPhotoMap] = useState<Record<number, StayPhoto[]>>({});
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadData = useCallback(async () => {
    const [s, e] = await Promise.all([
      getTodayStays(db),
      getLatestRawEvents(db, PAGE_SIZE),
    ]);
    setStays(s);
    setEvents(e);

    const pMap: Record<number, StayPhoto[]> = {};
    for (const st of s) {
      const photos = await getPhotosByStayId(db, st.id);
      if (photos.length > 0) pMap[st.id] = photos;
    }
    setPhotoMap(pMap);
  }, [db]);

  useFocusEffect(
    useCallback(() => {
      loadData();
    }, [loadData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadData();
    setRefreshing(false);
  }, [loadData]);

  return (
    <View style={styles.container}>
      <View style={styles.toggleRow}>
        <Pressable
          style={[styles.toggleBtn, mode === "stays" && styles.toggleActive]}
          onPress={() => setMode("stays")}
        >
          <Text style={[styles.toggleText, mode === "stays" && styles.toggleTextActive]}>
            滞在
          </Text>
        </Pressable>
        <Pressable
          style={[styles.toggleBtn, mode === "raw" && styles.toggleActive]}
          onPress={() => setMode("raw")}
        >
          <Text style={[styles.toggleText, mode === "raw" && styles.toggleTextActive]}>
            Raw Events
          </Text>
        </Pressable>
      </View>

      {mode === "stays" ? (
        stays.length === 0 ? (
          <View style={styles.placeholder}>
            <Text style={styles.placeholderText}>
              検出された滞在がまだありません
            </Text>
          </View>
        ) : (
          <FlatList
            data={stays}
            keyExtractor={(item) => String(item.id)}
            renderItem={({ item }) => (
              <View style={styles.stayCardWrapper}>
                <StayCard stay={item} photos={photoMap[item.id]} />
              </View>
            )}
            ItemSeparatorComponent={() => <View style={{ height: 8 }} />}
            contentContainerStyle={styles.listContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          />
        )
      ) : events.length === 0 ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            位置情報イベントがまだありません
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <RawEventRow item={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.listContent}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#f8fafc",
  },
  toggleRow: {
    flexDirection: "row",
    marginHorizontal: 16,
    marginVertical: 12,
    backgroundColor: "#e2e8f0",
    borderRadius: 10,
    padding: 3,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 8,
    alignItems: "center",
    borderRadius: 8,
  },
  toggleActive: {
    backgroundColor: "#ffffff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 2,
    elevation: 1,
  },
  toggleText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#64748b",
  },
  toggleTextActive: {
    color: "#0f172a",
    fontWeight: "600",
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  stayCardWrapper: {
    marginBottom: 0,
  },
  placeholder: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  placeholderText: {
    fontSize: 15,
    color: "#94a3b8",
    textAlign: "center",
    lineHeight: 24,
  },
  rawRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    backgroundColor: "#ffffff",
    paddingHorizontal: 0,
    borderRadius: 0,
  },
  rawLeft: {
    flex: 1,
  },
  rawTime: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: "#0f172a",
  },
  rawCoord: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    color: "#64748b",
    marginTop: 2,
  },
  rawRight: {
    alignItems: "flex-end",
  },
  rawAcc: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    color: "#0f172a",
  },
  rawSource: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e2e8f0",
  },
});
