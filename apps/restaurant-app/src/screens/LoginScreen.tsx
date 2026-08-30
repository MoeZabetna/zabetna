import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { supabase } from "../lib/supabase";
import { color, radius, space, type } from "../theme";

export function LoginScreen({ externalError }: { externalError: string | null }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSignIn() {
    if (!email.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setSubmitting(true);
    setError(null);
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });
    setSubmitting(false);
    if (signInError) {
      setError(signInError.message === "Invalid login credentials" ? "Incorrect email or password." : signInError.message);
    }
    // On success, App.tsx's onAuthStateChange listener takes it from here.
  }

  const shownError = error ?? externalError;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View style={styles.content}>
          <Text style={styles.brand}>Zabetna</Text>
          <Text style={styles.subtitle}>Shop sign-in</Text>

          {shownError && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{shownError}</Text>
            </View>
          )}

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Email</Text>
            <TextInput
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="email-address"
              textContentType="username"
              placeholder="you@shop.com"
              placeholderTextColor={color.inkFaint}
              style={styles.input}
            />
          </View>

          <View style={styles.field}>
            <Text style={styles.fieldLabel}>Password</Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              textContentType="password"
              placeholder="••••••••"
              placeholderTextColor={color.inkFaint}
              style={styles.input}
              onSubmitEditing={handleSignIn}
            />
          </View>

          <Pressable
            onPress={handleSignIn}
            disabled={submitting}
            style={({ pressed }) => [styles.button, (pressed || submitting) && styles.buttonPressed]}
          >
            {submitting ? <ActivityIndicator color={color.surface} /> : <Text style={styles.buttonText}>Sign in</Text>}
          </Pressable>

          <Text style={styles.hint}>
            Ask your Zabetna admin for a login if you don&apos;t have one yet.
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  flex: { flex: 1 },
  content: { flex: 1, justifyContent: "center", paddingHorizontal: space.lg },
  brand: { ...type.title, color: color.purple, textAlign: "center" },
  subtitle: { ...type.body, color: color.inkMuted, textAlign: "center", marginTop: space.xs, marginBottom: space.xl },
  errorBox: {
    backgroundColor: color.dangerFaint,
    borderRadius: radius.sm,
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    marginBottom: space.md,
  },
  errorText: { ...type.body, color: color.danger },
  field: { marginBottom: space.md },
  fieldLabel: { ...type.label, color: color.inkMuted, marginBottom: space.xs },
  input: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: color.ink,
  },
  button: {
    backgroundColor: color.purple,
    borderRadius: radius.sm,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: space.sm,
  },
  buttonPressed: { opacity: 0.85 },
  buttonText: { ...type.heading, color: color.surface },
  hint: { ...type.caption, color: color.inkMuted, textAlign: "center", marginTop: space.lg },
});
