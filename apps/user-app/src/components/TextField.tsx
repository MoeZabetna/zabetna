import { useState } from "react";
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { color, radius, space, type } from "../theme";
import type { IoniconName } from "../types/home";

/**
 * The auth screens' input field (Figma "Input with label", node 39:2043 and
 * siblings): a 12px SemiBold label over a pill-radius bordered box with an
 * optional trailing icon.
 *
 * Figma's icons are named from icon libraries this project doesn't bundle
 * (oui:email, fluent:call-20-regular, solar:eye-broken). Following the
 * convention already set in CategoryTile.tsx, each is mapped to its closest
 * Ionicon rather than importing three more icon sets to pixel-match.
 */
export function TextField({
  label,
  icon,
  error,
  secure,
  style,
  ...inputProps
}: {
  label: string;
  icon?: IoniconName;
  error?: string | null;
  /** Renders a masked field with the eye toggle from the design. */
  secure?: boolean;
} & TextInputProps) {
  const [hidden, setHidden] = useState(true);

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={[styles.box, Boolean(error) && styles.boxError]}>
        <TextInput
          style={styles.input}
          placeholderTextColor={color.inputPlaceholder}
          secureTextEntry={secure ? hidden : false}
          // The default on iOS is to autocapitalise, which silently corrupts
          // typed emails — every auth field here wants it off.
          autoCapitalize={inputProps.autoCapitalize ?? "none"}
          autoCorrect={inputProps.autoCorrect ?? false}
          {...inputProps}
        />
        {secure ? (
          <Pressable
            onPress={() => setHidden((v) => !v)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={hidden ? "Show password" : "Hide password"}
          >
            <Ionicons name={hidden ? "eye-outline" : "eye-off-outline"} size={16} color={color.textMuted} />
          </Pressable>
        ) : icon ? (
          <Ionicons name={icon} size={16} color={color.textMuted} />
        ) : null}
      </View>
      {Boolean(error) && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 6, width: "100%" },
  label: { ...type.inputLabel, color: color.inputLabel },
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    borderWidth: 1,
    borderColor: color.inputBorder,
    borderRadius: radius.pill,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  boxError: { borderColor: color.danger },
  input: { ...type.inputText, flex: 1, color: color.primaryBlack, padding: 0 },
  error: { ...type.disclosure, color: color.danger, paddingHorizontal: 14 },
});
