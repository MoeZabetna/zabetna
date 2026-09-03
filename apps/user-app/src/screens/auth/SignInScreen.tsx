import { useState } from "react";
import { Alert, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLogo } from "../../components/BrandLogo";
import { PrimaryButton } from "../../components/PrimaryButton";
import { TextField } from "../../components/TextField";
import { useAuth } from "../../lib/auth";
import { color, layout, space, type } from "../../theme";

// Sign in — Figma node 36:956. Layout is the design's: a 327px column at
// x=24, logo pinned top, the form group pinned bottom with 32px gaps.
export function SignInScreen({ onGoToSignUp }: { onGoToSignUp: () => void }) {
  const { signIn, sendPasswordReset } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const canSubmit = email.trim().length > 0 && password.length > 0;

  async function onSubmit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    const result = await signIn(email, password);
    setBusy(false);
    // On success there is nothing to do: the auth listener in AuthProvider
    // swaps the navigator over to the app stack.
    if (!result.ok) setError(result.message);
  }

  async function onForgotPassword() {
    if (!email.trim()) {
      setError("Enter your email first, then tap Forgot password.");
      return;
    }
    const result = await sendPasswordReset(email);
    if (result.ok) {
      Alert.alert(
        "Check your email",
        `If an account exists for ${email.trim()}, we've sent a link to reset the password.`
      );
    } else {
      setError(result.message);
    }
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.logoWrap}>
            <BrandLogo />
          </View>

          <View style={styles.form}>
            <View style={styles.fields}>
              <TextField
                label="Email"
                icon="mail-outline"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
                returnKeyType="next"
              />
              <TextField
                label="Password"
                secure
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                textContentType="password"
                autoComplete="current-password"
                returnKeyType="go"
                onSubmitEditing={onSubmit}
              />
              <View style={styles.forgotRow}>
                <Pressable onPress={onForgotPassword} hitSlop={8} accessibilityRole="button">
                  <Text style={styles.forgot}>Forgot password</Text>
                </Pressable>
              </View>
            </View>

            {Boolean(error) && <Text style={styles.error}>{error}</Text>}

            <PrimaryButton label="Sign In" onPress={onSubmit} disabled={!canSubmit} loading={busy} />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Don’t have an account</Text>
              <Pressable onPress={onGoToSignUp} hitSlop={8} accessibilityRole="button">
                <Text style={styles.footerLink}>Sign Up</Text>
              </Pressable>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.white },
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingHorizontal: layout.gutter,
    paddingTop: 46,
    paddingBottom: space.xl,
    justifyContent: "space-between",
    gap: space.xl,
  },
  logoWrap: { alignItems: "center" },
  form: { gap: space.xl, width: "100%" },
  fields: { gap: space.sm },
  forgotRow: { flexDirection: "row", justifyContent: "flex-end", width: "100%" },
  forgot: { ...type.smallLink, color: color.linkBlue, textDecorationLine: "underline" },
  error: { ...type.disclosure, color: color.danger, textAlign: "center" },
  footer: { flexDirection: "row", gap: space.xs, justifyContent: "center", alignItems: "baseline" },
  footerText: { ...type.authFootnote, color: color.black },
  footerLink: { ...type.authFootnoteLink, color: color.purple, textDecorationLine: "underline" },
});
