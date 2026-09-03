import { Image, StyleSheet } from "react-native";
import { layout } from "../theme";

/**
 * The Zabetna mark + wordmark, exported from Figma node 39:2031 at 3x
 * (464x540 px for the 154x180 pt box the design draws it in).
 *
 * It is a raster export rather than re-drawn vectors on purpose: the mark
 * is six overlapping gradient vectors with a `mix-blend-multiply` layer,
 * and the wordmark is set in "Dortage", a font this project doesn't have a
 * licence for or a copy of. Re-authoring either would change the brand.
 */
export function BrandLogo({ scale = 1 }: { scale?: number }) {
  return (
    <Image
      source={require("../../assets/brand/logo.png")}
      style={[styles.logo, { width: layout.logo.width * scale, height: layout.logo.height * scale }]}
      resizeMode="contain"
      accessibilityRole="image"
      accessibilityLabel="Zabetna"
    />
  );
}

const styles = StyleSheet.create({
  logo: { width: layout.logo.width, height: layout.logo.height },
});
