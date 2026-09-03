import { useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { BrandLogo } from "../../components/BrandLogo";
import { PrimaryButton } from "../../components/PrimaryButton";
import { TextField } from "../../components/TextField";
import { useAuth } from "../../lib/auth";
import { supabase } from "../../lib/supabase";
import { color, layout, space, type } from "../../theme";

// Sign Up — Figma node 36:994. Collects Name, Email, Phone number,
// Password, in that order.
//
// The phone number is not cosmetic: `profiles.phone` is where every reward
// payout is sent, and `set_reward_request_amounts()` refuses to create a
// payout request without one. It is also UNIQUE, so it's checked against
// `phone_available()` before submitting — otherwise a duplicate surfaces
// from Supabase as an opaque "Database error saving new user".
//
// The Figma flow continues into "verify your number" (36:707) and
// "verified" (36:835). Those are NOT wired up: verifying a number means
// sending an SMS, which needs a paid provider configured in Supabase.
// Until that exists the number is stored unverified rather than showing a
// success screen that didn't verify anything.
export function SignUpScreen({ onGoToSignIn }: { onGoToSignIn: () => void }) {
  const { signUp } = useAuth();
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [phoneError, setPhoneError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmationSent, setConfirmationSent] = useState(false);

  const canSubmit =
    fullName.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    password.length >= 6;

  async function onSubmit() {
    if (!canSubmit || busy) return;
    setBusy(true);
    setError(null);
    setPhoneError(null);

    const { data: available, error: rpcError } = await supabase.rpc("phone_available", {
      candidate: phone.trim(),
    });
    // A failed availability check is not a reason to block the signup — the
    // UNIQUE constraint still protects the data. Fall through and let the
    // real attempt decide.
    if (!rpcError && available === false) {
      setBusy(false);
      setPhoneError("That phone number is already registered to another account.");
      return;
    }

    const result = await signUp({ fullName, email, phone, password });
    setBusy(false);

    if (!result.ok) {
      setError(result.message);
      return;
    }
    if (result.needsEmailConfirmation) {
      setConfirmationSent(true);
      return;
    }
    // Otherwise the session already exists and AuthProvider swaps to the app.
  }

  if (confirmationSent) {
    return (
      <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
        <View style={styles.confirmWrap}>
          <BrandLogo scale={0.7} />
          <Text style={styles.confirmTitle}>Confirm your email</Text>
          <Text style={styles.confirmBody}>
            We sent a confirmation link to {email.trim()}. Open it, then come back and sign in.
          </Text>
          <PrimaryButton label="Back to Sign In" onPress={onGoToSignIn} />
        </View>
      </SafeAreaView>
    );
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
            <BrandLogo scale={0.8} />
          </View>

          <View style={styles.form}>
            <View style={styles.fields}>
              <TextField
                label="Name"
                placeholder="Enter your name"
                value={fullName}
                onChangeText={setFullName}
                autoCapitalize="words"
                textContentType="name"
                autoComplete="name"
              />
              <TextField
                label="Email"
                icon="mail-outline"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                textContentType="emailAddress"
                autoComplete="email"
              />
              <TextField
                label="Phone number"
                icon="call-outline"
                placeholder="Enter your phone number"
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  if (phoneError) setPhoneError(null);
                }}
                keyboardType="phone-pad"
                textContentType="telephoneNumber"
                autoComplete="tel"
                error={phoneError}
              />
              <TextField
                label="Password"
                secure
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                textContentType="newPassword"
                autoComplete="new-password"
              />
            </View>

            <Text style={styles.hint}>
              Your phone number is where reward payouts are sent, so make sure it can receive Wish Money.
            </Text>

            {Boolean(error) && <Text style={styles.error}>{error}</Text>}

            <PrimaryButton label="Sign Up" onPress={onSubmit} disabled={!canSubmit} loading={busy} />

            <View style={styles.footer}>
              <Text style={styles.footerText}>Already have an account</Text>
              <Pressable onPress={onGoToSignIn} hitSlop={8} accessibilityRole="button">
                <Text style={styles.footerLink}>Sign In</Text>
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
    paddingTop: 32,
    paddingBottom: space.xl,
    justifyContent: "space-between",
    gap: space.lg,
  },
  logoWrap: { alignItems: "center" },
  form: { gap: space.lg, width: "100%" },
  fields: { gap: 12 },
  hint: { ...type.disclosure, color: color.textMuted },
  error: { ...type.disclosure, color: color.danger, textAlign: "center" },
  footer: { flexDirection: "row", gap: space.xs, justifyContent: "center", alignItems: "baseline" },
  footerText: { ...type.authFootnote, color: color.black },
  footerLink: { ...type.authFootnoteLink, color: color.purple, textDecorationLine: "underline" },

  confirmWrap: {
    flex: 1,
    paddingHorizontal: layout.gutter,
    alignItems: "center",
    justifyContent: "center",
    gap: space.md,
  },
  confirmTitle: { ...type.sectionTitle, color: color.primaryBlack, textAlign: "center" },
  confirmBody: { ...type.cardTitle, color: color.textMuted, textAlign: "center", marginBottom: space.sm },
});
