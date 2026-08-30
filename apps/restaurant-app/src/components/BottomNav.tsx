import { Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { color, space, type } from "../theme";

export type NavKey = "redeem" | "reports";

const TABS: { key: NavKey; label: string; icon: keyof typeof Ionicons.glyphMap }[] = [
  { key: "redeem", label: "Redeem", icon: "qr-code-outline" },
  { key: "reports", label: "Reports", icon: "bar-chart-outline" },
];

export function BottomNav({
  active,
  onChange,
  onSignOut,
}: {
  active: NavKey;
  onChange: (key: NavKey) => void;
  onSignOut: () => void;
}) {
  return (
    <SafeAreaView edges={["bottom"]} style={styles.safe}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <Pressable key={tab.key} onPress={() => onChange(tab.key)} style={styles.tile}>
              <Ionicons name={tab.icon} size={22} color={isActive ? color.purple : color.inkMuted} />
              <Text style={[styles.label, isActive && styles.labelActive]}>{tab.label}</Text>
            </Pressable>
          );
        })}
        <Pressable onPress={onSignOut} style={styles.tile}>
          <Ionicons name="log-out-outline" size={22} color={color.inkMuted} />
          <Text style={styles.label}>Sign out</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { backgroundColor: color.surface, borderTopWidth: 1, borderTopColor: color.border },
  bar: { flexDirection: "row", paddingTop: space.sm },
  tile: { flex: 1, alignItems: "center", gap: 2, paddingBottom: space.xs },
  label: { ...type.caption, color: color.inkMuted },
  labelActive: { color: color.purple, fontWeight: "600" },
});
