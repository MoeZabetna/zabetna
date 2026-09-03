import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import QRCode from "react-native-qrcode-svg";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { createRedemption } from "@zabetna/api-client";
import type { RedemptionToken } from "@zabetna/shared-types";
import { supabase } from "../lib/supabase";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { color, radius, space, type } from "../theme";

// Redemption Confirmation — Figma nodes 62:1905 / 122:2887 / 184:172.
// The design draws each state as its own frame; in code they are states of
// one screen, because they share the whole header and differ only in the
// middle block.
//
// The redemption itself is created by the `create-redemption` edge
// function, never by an insert from here: per-user and total limits, the
// offer's day-of-week schedule and its live window are all enforced there,
// and docs/blueprint.html §04 is explicit that this logic lives in exactly
// one place.

type Props = NativeStackScreenProps<RootStackParamList, "Redeem">;

type Phase =
  | { kind: "creating" }
  | { kind: "active"; token: RedemptionToken }
  | { kind: "verified" }
  | { kind: "expired" }
  | { kind: "error"; message: string };

/** How often to ask the database whether staff have verified the code yet. */
const POLL_MS = 3000;

export function RedeemScreen({ route, navigation }: Props) {
  const { offerId, offerTitle, shopName } = route.params;
  const [phase, setPhase] = useState<Phase>({ kind: "creating" });
  const [secondsLeft, setSecondsLeft] = useState<number | null>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // ── Create the redemption once, on mount ────────────────────────────────
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const token = await createRedemption(supabase, offerId);
        if (!cancelled) setPhase({ kind: "active", token });
      } catch (err) {
        if (cancelled) return;
        // create-redemption returns its refusals ("daily limit reached",
        // "offer not available today") as errors — show them, because they
        // are the answer to the user's question, not a crash.
        setPhase({ kind: "error", message: err instanceof Error ? err.message : "Could not create a code." });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [offerId]);

  // ── Countdown to expiry ─────────────────────────────────────────────────
  useEffect(() => {
    if (phase.kind !== "active") return;
    const expiresAt = new Date(phase.token.expiresAt).getTime();

    const tick = () => {
      const remaining = Math.max(0, Math.round((expiresAt - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) setPhase({ kind: "expired" });
    };
    tick();
    const timer = setInterval(tick, 1000);
    return () => clearInterval(timer);
  }, [phase]);

  // ── Poll for the shop verifying it ──────────────────────────────────────
  useEffect(() => {
    if (phase.kind !== "active") {
      if (pollTimer.current) {
        clearInterval(pollTimer.current);
        pollTimer.current = null;
      }
      return;
    }

    const redemptionId = phase.token.redemptionId;
    pollTimer.current = setInterval(async () => {
      const { data } = await supabase
        .from("redemptions")
        .select("status")
        .eq("id", redemptionId)
        .maybeSingle();

      if (data?.status === "verified") setPhase({ kind: "verified" });
      else if (data?.status === "expired" || data?.status === "cancelled") setPhase({ kind: "expired" });
    }, POLL_MS);

    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      pollTimer.current = null;
    };
  }, [phase]);

  const close = useCallback(() => navigation.goBack(), [navigation]);

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <Pressable onPress={close} hitSlop={10} accessibilityRole="button">
          <Ionicons name="close" size={26} color={color.primaryBlack} />
        </Pressable>
      </View>

      <View style={styles.body}>
        <Text style={styles.shop}>{shopName}</Text>
        <Text style={styles.offer}>{offerTitle}</Text>

        {phase.kind === "creating" && (
          <View style={styles.block}>
            <ActivityIndicator color={color.purple} />
            <Text style={styles.hint}>Creating your code…</Text>
          </View>
        )}

        {phase.kind === "active" && (
          <View style={styles.block}>
            <View style={styles.qrFrame}>
              <QRCode value={phase.token.token} size={220} backgroundColor={color.white} color={color.primaryBlack} />
            </View>
            <Text style={styles.manualLabel}>Or give the shop this code</Text>
            <Text style={styles.manualCode} selectable>
              {phase.token.token}
            </Text>
            {secondsLeft !== null && (
              <Text style={[styles.timer, secondsLeft <= 30 && styles.timerUrgent]}>
                Expires in {formatCountdown(secondsLeft)}
              </Text>
            )}
            <Text style={styles.hint}>Show this to the staff. Keep this screen open until they've scanned it.</Text>
          </View>
        )}

        {phase.kind === "verified" && (
          <View style={styles.block}>
            <Ionicons name="checkmark-circle" size={72} color={color.success} />
            <Text style={styles.stateTitle}>Redeemed</Text>
            <Text style={styles.hint}>
              Enjoy it. You earned 1 point ($0.25) — it's already in your Rewards balance.
            </Text>
            <Pressable style={styles.cta} onPress={close}>
              <Text style={styles.ctaLabel}>Done</Text>
            </Pressable>
          </View>
        )}

        {phase.kind === "expired" && (
          <View style={styles.block}>
            <Ionicons name="time-outline" size={72} color={color.textMuted} />
            <Text style={styles.stateTitle}>Code expired</Text>
            <Text style={styles.hint}>
              Codes are only valid for a few minutes so they can't be shared or reused. Start again when you're at the
              counter.
            </Text>
            <Pressable style={styles.cta} onPress={close}>
              <Text style={styles.ctaLabel}>Back to offer</Text>
            </Pressable>
          </View>
        )}

        {phase.kind === "error" && (
          <View style={styles.block}>
            <Ionicons name="alert-circle-outline" size={72} color={color.danger} />
            <Text style={styles.stateTitle}>Couldn't create a code</Text>
            <Text style={styles.hint}>{phase.message}</Text>
            <Pressable style={styles.cta} onPress={close}>
              <Text style={styles.ctaLabel}>Back to offer</Text>
            </Pressable>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

function formatCountdown(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.white },
  header: { paddingHorizontal: space.lg, paddingBottom: space.sm, alignItems: "flex-start" },
  body: { flex: 1, paddingHorizontal: space.lg, alignItems: "center", gap: space.xs },
  shop: { ...type.sectionTitle, color: color.primaryBlack, textAlign: "center", textTransform: "none" },
  offer: { ...type.cardTitle, color: color.textMuted, textAlign: "center" },
  block: { alignItems: "center", gap: space.md, marginTop: space.xl, width: "100%" },
  qrFrame: {
    padding: space.md,
    borderRadius: radius.md,
    backgroundColor: color.white,
    shadowColor: color.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  manualLabel: { ...type.caption, color: color.textMuted },
  manualCode: { ...type.cardTitleStrong, color: color.primaryBlack, letterSpacing: 2 },
  timer: { ...type.cardTitleStrong, color: color.purple },
  timerUrgent: { color: color.danger },
  hint: { ...type.disclosure, color: color.textMuted, textAlign: "center", paddingHorizontal: space.md },
  stateTitle: { ...type.sectionTitle, color: color.primaryBlack, textTransform: "none" },
  cta: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: color.purple,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: space.xl,
    marginTop: space.sm,
  },
  ctaLabel: { ...type.ctaLabel, color: color.white },
});
