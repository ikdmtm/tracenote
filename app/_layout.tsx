import "@/core/location/backgroundTask";
import "@/i18n";

import { Stack } from "expo-router";
import { SQLiteProvider } from "expo-sqlite";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";

import { DB_NAME, initDatabase } from "@/core/storage/db";
import { SubscriptionProvider } from "@/features/monetization/SubscriptionContext";
import { ThemeProvider } from "@/features/theme/ThemeContext";

function AppContent() {
  const { t } = useTranslation();
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen
          name="diary"
          options={{ headerShown: true, title: t("screenTitle.summary"), presentation: "card" }}
        />
        <Stack.Screen
          name="stay-detail"
          options={{ headerShown: true, title: t("screenTitle.stayDetail"), presentation: "card" }}
        />
        <Stack.Screen
          name="edit-stay"
          options={{
            headerShown: true,
            title: t("screenTitle.editStay"),
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="share"
          options={{
            headerShown: true,
            title: t("screenTitle.share"),
            presentation: "modal",
          }}
        />
        <Stack.Screen
          name="export"
          options={{
            headerShown: true,
            title: t("screenTitle.export"),
            presentation: "modal",
          }}
        />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SQLiteProvider databaseName={DB_NAME} onInit={initDatabase}>
      <ThemeProvider>
        <SubscriptionProvider>
          <AppContent />
        </SubscriptionProvider>
      </ThemeProvider>
    </SQLiteProvider>
  );
}
