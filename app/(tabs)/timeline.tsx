import { useSQLiteContext } from "expo-sqlite";
import { useCallback, useEffect, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from "react-native";

import type { RawEvent } from "@/core/domain/models";
import { getLatestRawEvents } from "@/core/storage/rawEventRepo";

function formatTs(ts: number): string {
  const d = new Date(ts);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getMonth() + 1)}/${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function EventRow({ item }: { item: RawEvent }) {
  return (
    <View style={styles.row}>
      <View style={styles.rowLeft}>
        <Text style={styles.rowTime}>{formatTs(item.ts)}</Text>
        <Text style={styles.rowCoord}>
          {item.lat.toFixed(5)}, {item.lng.toFixed(5)}
        </Text>
      </View>
      <View style={styles.rowRight}>
        <Text style={styles.rowAcc}>±{Math.round(item.acc)}m</Text>
        <Text style={styles.rowSource}>{item.source}</Text>
      </View>
    </View>
  );
}

const PAGE_SIZE = 100;

export default function TimelineScreen() {
  const db = useSQLiteContext();
  const [events, setEvents] = useState<RawEvent[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const loadEvents = useCallback(async () => {
    const rows = await getLatestRawEvents(db, PAGE_SIZE);
    setEvents(rows);
  }, [db]);

  useEffect(() => {
    loadEvents();
  }, [loadEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadEvents();
    setRefreshing(false);
  }, [loadEvents]);

  return (
    <View style={styles.container}>
      {events.length === 0 ? (
        <View style={styles.placeholder}>
          <Text style={styles.placeholderText}>
            位置情報イベントがまだありません{"\n"}
            バックグラウンドで収集が始まると{"\n"}ここに表示されます
          </Text>
        </View>
      ) : (
        <FlatList
          data={events}
          keyExtractor={(item) => String(item.id)}
          renderItem={({ item }) => <EventRow item={item} />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
          contentContainerStyle={styles.list}
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
  list: {
    paddingVertical: 8,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: "#ffffff",
  },
  rowLeft: {
    flex: 1,
  },
  rowTime: {
    fontSize: 14,
    fontWeight: "600",
    fontVariant: ["tabular-nums"],
    color: "#0f172a",
  },
  rowCoord: {
    fontSize: 12,
    fontVariant: ["tabular-nums"],
    color: "#64748b",
    marginTop: 2,
  },
  rowRight: {
    alignItems: "flex-end",
  },
  rowAcc: {
    fontSize: 13,
    fontVariant: ["tabular-nums"],
    color: "#0f172a",
  },
  rowSource: {
    fontSize: 11,
    color: "#94a3b8",
    marginTop: 2,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: "#e2e8f0",
    marginLeft: 16,
  },
});
