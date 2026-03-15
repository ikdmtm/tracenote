import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Text, StyleSheet } from "react-native";

function HeaderTitle() {
  return <Text style={styles.headerTitle}>TraceNote</Text>;
}

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        tabBarActiveTintColor: "#2563eb",
        tabBarInactiveTintColor: "#94a3b8",
        headerStyle: { backgroundColor: "#ffffff" },
        headerTitle: () => <HeaderTitle />,
        headerTitleAlign: "left",
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          tabBarLabel: "ホーム",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="home-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="timeline"
        options={{
          tabBarLabel: "タイムライン",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="time-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          tabBarLabel: "設定",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="settings-outline" size={size} color={color} />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  headerTitle: {
    fontSize: 17,
    fontWeight: "700",
    color: "#1e293b",
    letterSpacing: 0.3,
  },
});
