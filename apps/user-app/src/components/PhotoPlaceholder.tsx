import { Image, StyleSheet, View, type ImageStyle, type StyleProp, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { color, radius } from "../theme";

/**
 * Renders a shop/offer photo when a URL is available, and a labeled
 * placeholder otherwise. This is the ONE place image-or-placeholder logic
 * lives — every card in the app should go through this component rather
 * than each screen re-implementing its own fallback.
 *
 * Every slot on the current Home Screen renders the placeholder branch: the
 * Figma file's stock photos couldn't be pulled into this build (see
 * docs/blueprint.html changelog) and no shop has uploaded real photos yet.
 * Nothing else about the layout depends on that — once `shops.cover_images`
 * has a URL, this same component renders it full-bleed with no screen
 * change required.
 */
export function PhotoPlaceholder({
  uri,
  style,
  radius: r = radius.sm,
}: {
  uri?: string;
  // Callers only ever pass width/height/margin-type dimensions, which are
  // valid on both View and Image — accepted as ViewStyle and re-asserted
  // for the Image branch rather than widening this to `any`.
  style?: StyleProp<ViewStyle>;
  radius?: number;
}) {
  if (uri) {
    return (
      <Image
        source={{ uri }}
        style={[style as StyleProp<ImageStyle>, { borderRadius: r }]}
        resizeMode="cover"
      />
    );
  }
  return (
    <View style={[styles.placeholder, style, { borderRadius: r }]}>
      <Ionicons name="image-outline" size={22} color={color.placeholderIcon} />
    </View>
  );
}

const styles = StyleSheet.create({
  placeholder: {
    backgroundColor: color.placeholderBg,
    alignItems: "center",
    justifyContent: "center",
  },
});
