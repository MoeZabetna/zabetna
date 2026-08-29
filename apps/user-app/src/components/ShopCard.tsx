import { Pressable, StyleSheet, Text, View } from "react-native";
import { PhotoPlaceholder } from "./PhotoPlaceholder";
import { color, radius, space, type as t } from "../theme";
import type { ShopCardData } from "../types/home";

// Matches the "Featured X" card from get_design_context on node 40:3000
// (data-node-id 323:334 etc.): 110x162 card, 94px photo, name, pink CTA.
export function ShopCard({ shop, onPress }: { shop: ShopCardData; onPress?: () => void }) {
  return (
    <View style={styles.card}>
      <View style={styles.inner}>
        <View style={styles.photoWrap}>
          <PhotoPlaceholder uri={shop.imageUrl} style={styles.photo} radius={radius.sm} />
          <Text style={styles.name} numberOfLines={1}>
            {shop.name}
          </Text>
        </View>
        <Pressable style={styles.cta} onPress={onPress}>
          <Text style={styles.ctaLabel}>View Details</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    width: 110,
    height: 162,
    backgroundColor: color.white,
    borderRadius: radius.md,
    padding: space.xs,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: color.cardShadowPink,
    shadowOpacity: 1,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 2,
  },
  inner: { width: 102, height: 152, justifyContent: "space-between" },
  photoWrap: { gap: 2 },
  photo: { width: "100%", height: 94 },
  name: { ...t.cardTitle, color: color.textFaint, textAlign: "center" },
  cta: {
    height: 27,
    borderRadius: radius.sm,
    backgroundColor: color.pink,
    alignItems: "center",
    justifyContent: "center",
  },
  ctaLabel: { ...t.cardButton, color: color.white },
});
