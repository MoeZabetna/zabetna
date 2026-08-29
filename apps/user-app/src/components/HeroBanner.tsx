import { StyleSheet, Text, View } from "react-native";
import { color, radius, space } from "../theme";

// Promo carousel slot (data-node-id 56:359, 190px tall, full width). The
// real Figma banner art couldn't be pulled into this build — see
// PhotoPlaceholder's doc comment — so this renders the banner's actual
// *content* (copy, from the design) on a flat brand-color ground instead of
// a fake photo. Once `banners.image_url` exists this becomes an <Image>
// carousel per docs/blueprint.html §03 (Merchandising).
export function HeroBanner({ headline = "MEGA SALE", sub = "Limited time only", cta = "Shop Now" }) {
  return (
    <View style={styles.banner}>
      <Text style={styles.sub}>{sub}</Text>
      <Text style={styles.headline}>{headline}</Text>
      <View style={styles.ctaPill}>
        <Text style={styles.ctaLabel}>{cta}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    height: 190,
    borderRadius: radius.md,
    backgroundColor: color.primaryBlack,
    padding: space.lg,
    justifyContent: "center",
    gap: 4,
  },
  sub: { color: color.white, fontSize: 12, letterSpacing: 1, textTransform: "uppercase", opacity: 0.8 },
  headline: { color: color.white, fontSize: 32, fontWeight: "800", letterSpacing: 1 },
  ctaPill: {
    marginTop: space.sm,
    alignSelf: "flex-start",
    backgroundColor: color.pink,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
  },
  ctaLabel: { color: color.white, fontSize: 12, fontWeight: "700" },
});
