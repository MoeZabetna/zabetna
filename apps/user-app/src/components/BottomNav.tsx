import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { color, radius } from "../theme";
import type { IoniconName } from "../types/home";

export type NavKey = "home" | "categories" | "profile";

const TABS: { key: NavKey; icon: IoniconName }[] = [
  { key: "home", icon: "home-outline" },
  { key: "categories", icon: "grid-outline" },
  { key: "profile", icon: "person-outline" },
];

// Floating pill nav (data-node-id 56:361) — purple bar, active tile in
// skyblue. Only Home/Categories/Profile are wired to a screen so far; see
// docs/blueprint.html §06 for the rest of the Main Screens set.
export function BottomNav({ active, onSelect }: { active: NavKey; onSelect?: (key: NavKey) => void }) {
  return (
    <View style={styles.bar}>
      {TABS.map((tab) => {
        const isActive = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            style={[styles.tile, isActive && styles.tileActive]}
            onPress={() => onSelect?.(tab.key)}
          >
            <Ionicons name={tab.icon} size={24} color={isActive ? color.primaryBlack : color.white} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    alignSelf: "center",
    width: 255,
    height: 68,
    paddingHorizontal: 8,
    borderRadius: radius.md,
    backgroundColor: color.purple,
    borderWidth: 4,
    borderColor: "rgba(94,91,90,0.1)",
  },
  tile: {
    width: 58,
    height: 58,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  tileActive: { backgroundColor: color.skyblue },
});
