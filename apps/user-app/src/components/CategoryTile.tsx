import { Pressable, StyleSheet, Text } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { color, radius, type as t } from "../theme";
import type { CategoryTileData } from "../types/home";

// 100x100 tile from get_design_context (data-node-id 55:165 etc). The
// Figma icons are a mix of named icon-library glyphs (hugeicons, ion,
// iconoir, solar…) — mapped here to Ionicons equivalents rather than
// pixel-matched per-icon-family assets, so the whole category set stays
// one scalable, tintable icon font instead of a folder of loose SVGs.
export function CategoryTile({ category, onPress }: { category: CategoryTileData; onPress?: () => void }) {
  return (
    <Pressable style={styles.tile} onPress={onPress}>
      <Ionicons name={category.icon} size={40} color={color.primaryBlack} />
      <Text style={styles.label} numberOfLines={1}>
        {category.label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tile: {
    width: 100,
    height: 100,
    borderRadius: radius.md,
    backgroundColor: color.white,
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    shadowColor: color.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 7.5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  label: { ...t.categoryLabel, color: "#000000", textAlign: "center" },
});
