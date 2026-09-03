import { ActivityIndicator, Pressable, StyleSheet, Text } from "react-native";
import { color, layout, radius, type } from "../theme";

/**
 * The 56px pill CTA from the auth screens (Figma node 36:986 "Sign In",
 * 36:1019 "Sign Up"): full-width, `#913FE6`, radius 45.
 *
 * Distinct from the Rewards Screen's CTA, which is 48px tall at radius 8 —
 * that one follows the Redemption Confirmation screens. Two button shapes
 * genuinely exist in the design; this is not an inconsistency to unify.
 */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  loading,
}: {
  label: string;
  onPress?: () => void;
  disabled?: boolean;
  loading?: boolean;
}) {
  const inert = Boolean(disabled || loading);
  return (
    <Pressable
      style={({ pressed }) => [styles.button, inert && styles.disabled, pressed && !inert && styles.pressed]}
      onPress={onPress}
      disabled={inert}
      accessibilityRole="button"
      accessibilityState={{ disabled: inert, busy: Boolean(loading) }}
    >
      {loading ? <ActivityIndicator color={color.white} /> : <Text style={styles.label}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: layout.ctaHeight,
    borderRadius: radius.pill,
    backgroundColor: color.purple,
    alignItems: "center",
    justifyContent: "center",
    width: "100%",
  },
  disabled: { backgroundColor: color.disabled },
  pressed: { opacity: 0.9 },
  label: { ...type.authCta, color: color.white, textAlign: "center" },
});
