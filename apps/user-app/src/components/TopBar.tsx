import { Pressable, StyleSheet, Text, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { color, space } from "../theme";

// Menu / location-picker / profile row (data-node-id 55:137) plus the
// search bar beneath it (data-node-id 121:2880).
export function TopBar({
  city,
  area,
  onMenuPress,
  onLocationPress,
  onProfilePress,
  onSearchPress,
}: {
  city: string;
  area: string;
  onMenuPress?: () => void;
  onLocationPress?: () => void;
  onProfilePress?: () => void;
  onSearchPress?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Pressable onPress={onMenuPress} hitSlop={8}>
          <Ionicons name="menu-outline" size={24} color={color.primaryBlack} />
        </Pressable>
        <Pressable style={styles.location} onPress={onLocationPress} hitSlop={8}>
          <Ionicons name="location-outline" size={20} color={color.primaryBlack} />
          <Text style={styles.locationText}>
            <Text style={styles.city}>{city}, </Text>
            <Text style={styles.area}>{area}</Text>
          </Text>
          <Ionicons name="chevron-down" size={18} color={color.primaryBlack} />
        </Pressable>
        <Pressable onPress={onProfilePress} hitSlop={8}>
          <View style={styles.avatar}>
            <Ionicons name="person-outline" size={18} color={color.primaryBlack} />
          </View>
        </Pressable>
      </View>
      <Pressable style={styles.search} onPress={onSearchPress}>
        <Ionicons name="search-outline" size={18} color="rgba(33,33,33,0.5)" />
        <Text style={styles.searchLabel}>Search...</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  location: { flexDirection: "row", alignItems: "center", gap: 4 },
  locationText: { fontSize: 16 },
  city: { color: color.locationBlue },
  area: { color: color.textMuted, fontSize: 12 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E5E5E5",
    alignItems: "center",
    justifyContent: "center",
  },
  search: {
    height: 48,
    borderRadius: 12,
    backgroundColor: color.searchBg,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: space.sm,
  },
  searchLabel: { fontSize: 14, color: "rgba(33,33,33,0.5)" },
});
