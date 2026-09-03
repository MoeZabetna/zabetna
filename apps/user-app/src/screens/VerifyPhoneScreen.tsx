import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Image,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PrimaryButton } from "../components/PrimaryButton";
import { supabase } from "../lib/supabase";
import { SERVICE_FEE_USD, confirmPhoneOtp, formatUsd, sendPhoneOtp } from "../lib/rewards";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { color, layout, radius, space, type } from "../theme";

// Verify your number — Figma node 36:707.
//
// This frame was drawn for the sign-up flow but deliberately left unwired
// there (see docs/2026-09-02-user-app-build.md). Its real home, decided
// 2026-09-03, is here: verification happens at *payout* time, when the user
// has enough points and is about to have real money sent to the number.
// That way an SMS is only ever paid for by someone actually cashing out.
//
// The illustration is a 3x PNG export of node 36:711 (816x743 for the
// designed 272x247 box) rather than reassembled vectors — the subtree is
// 65+ SVG layers, so many that Figma's own asset export caps out and asks
// for a narrower node.

const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

type Props = NativeStackScreenProps<RootStackParamList, "VerifyPhone">;

export function VerifyPhoneScreen({ route, navigation }: Props) {
  const { phone } = route.params;
  const [code, setCode] = useState("");
  const [sending, setSending] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(RESEND_SECONDS);
  const inputRef = useRef<TextInput>(null);

  const send = useCallback(async () => {
    setSending(true);
    setError(null);
    const result = await sendPhoneOtp(supabase, phone);
    setSending(false);
    if (!result.ok) {
      setError(result.message);
      return;
    }
    setCooldown(RESEND_SECONDS);
  }, [phone]);

  // Send on arrival — the user pressed "Redeem", so asking them to press
  // "send code" as well would be a step for nothing.
  useEffect(() => {
    void send();
  }, [send]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setInterval(() => setCooldown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [cooldown]);

  const onConfirm = useCallback(async () => {
    if (code.length !== CODE_LENGTH || confirming) return;
    setConfirming(true);
    setError(null);
    const result = await confirmPhoneOtp(supabase, phone, code);
    setConfirming(false);

    if (!result.ok) {
      setError(result.message);
      setCode("");
      return;
    }
    // Straight back to Rewards, which re-reads the balance on focus and
    // will now find a verified number and an enabled Redeem button.
    navigation.goBack();
  }, [code, confirming, phone, navigation]);

  // Auto-submit on the sixth digit — the design has no "next" affordance
  // between the boxes and the CTA, and making someone tap Confirm after
  // typing the last digit is a step the code itself already implies.
  useEffect(() => {
    if (code.length === CODE_LENGTH) void onConfirm();
    // onConfirm is intentionally omitted: including it re-fires this on
    // every keystroke through its `code` dependency.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [code]);

  const digits = Array.from({ length: CODE_LENGTH }, (_, i) => code[i] ?? "");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <View style={styles.header}>
          <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button">
            <Ionicons name="chevron-back" size={24} color={color.primaryBlack} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          <Image
            source={require("../../assets/brand/verify-illustration.png")}
            style={styles.illustration}
            resizeMode="contain"
            accessibilityRole="image"
            accessibilityLabel=""
          />

          <View style={styles.copy}>
            <Text style={styles.title}>Verify</Text>
            <Text style={styles.subtitle}>
              {sending
                ? `Sending a code to ${phone}…`
                : `OTP has been sent to ${phone}. Check your inbox.`}
            </Text>
          </View>

          {/* One real input, six painted boxes. Six separate TextInputs is
              the usual approach and the usual source of backspace and
              paste bugs; the boxes here are a display of a single value. */}
          <Pressable style={styles.boxRow} onPress={() => inputRef.current?.focus()}>
            {digits.map((digit, index) => {
              const active = index === code.length;
              return (
                <View key={index} style={[styles.box, (Boolean(digit) || active) && styles.boxActive]}>
                  <Text style={styles.boxDigit}>{digit}</Text>
                  {active && <Text style={styles.caret}>|</Text>}
                </View>
              );
            })}
          </Pressable>

          <TextInput
            ref={inputRef}
            style={styles.hiddenInput}
            value={code}
            onChangeText={(v) => {
              setCode(v.replace(/\D/g, "").slice(0, CODE_LENGTH));
              if (error) setError(null);
            }}
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            autoFocus
            maxLength={CODE_LENGTH}
          />

          {Boolean(error) && <Text style={styles.error}>{error}</Text>}

          <Pressable onPress={() => void send()} disabled={cooldown > 0 || sending} hitSlop={8}>
            <Text style={[styles.resend, (cooldown > 0 || sending) && styles.resendDisabled]}>
              {cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
            </Text>
          </Pressable>

          <Text style={styles.feeNote}>
            Verifying costs nothing extra — the {formatUsd(SERVICE_FEE_USD)} service fee on your payout covers it.
          </Text>
        </ScrollView>

        <View style={styles.ctaWrap}>
          {confirming ? (
            <View style={styles.confirming}>
              <ActivityIndicator color={color.purple} />
            </View>
          ) : (
            <PrimaryButton label="Confirm" onPress={onConfirm} disabled={code.length !== CODE_LENGTH} />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.white },
  flex: { flex: 1 },
  header: { paddingHorizontal: layout.gutter, paddingBottom: space.xs },
  content: {
    paddingHorizontal: layout.gutter,
    alignItems: "center",
    gap: space.md,
    paddingBottom: space.lg,
  },
  illustration: { width: 272, height: 247 },
  copy: { gap: 2, alignItems: "center", width: "100%" },
  title: { fontFamily: "Poppins_500Medium", fontSize: 32, lineHeight: 40, color: color.linkBlue, textAlign: "center" },
  subtitle: { ...type.authFootnote, color: color.black, textAlign: "center" },

  boxRow: { flexDirection: "row", justifyContent: "space-between", width: "100%", marginTop: space.sm },
  box: {
    width: 44,
    height: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    borderColor: color.inputBorder,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
  },
  boxActive: { borderColor: color.purple },
  boxDigit: { fontFamily: "Poppins_700Bold", fontSize: 16, lineHeight: 24, color: color.textFaint },
  caret: { fontSize: 20, lineHeight: 24, color: color.purple },

  // Off-screen rather than `display: none` — a hidden input can't hold
  // focus on Android, and the keyboard would close on every keystroke.
  hiddenInput: { position: "absolute", opacity: 0, height: 1, width: 1 },

  error: { ...type.disclosure, color: color.danger, textAlign: "center" },
  resend: { ...type.smallLink, color: color.purple, textDecorationLine: "underline" },
  resendDisabled: { color: color.textMuted, textDecorationLine: "none" },
  feeNote: { ...type.disclosure, color: color.textMuted, textAlign: "center" },

  ctaWrap: { paddingHorizontal: layout.gutter, paddingBottom: space.md },
  confirming: { height: layout.ctaHeight, alignItems: "center", justifyContent: "center" },
});
