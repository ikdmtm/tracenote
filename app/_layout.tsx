import "@/core/location/backgroundTask";

import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";

import { DB_NAME, initDatabase } from "@/core/storage/db";

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={initDatabase}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="diary"
          options={{ headerShown: true, title: "日記", presentation: "card" }}
        />
        <Stack.Screen
          name="edit-stay"
          options={{
            headerShown: true,
            title: "滞在を編集",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="share"
          options={{
            headerShown: true,
            title: "共有",
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="export"
          options={{
            headerShown: true,
            title: "エクスポート",
            presentation: "modal",
          }}
        />
      </Stack>
    </SQLiteProvider>
  );
}
