import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase";
import {
  MIN_POINTS,
  SERVICE_FEE_USD,
  USD_PER_POINT,
  formatUsd,
  fetchPendingRequest,
  fetchPointsBalance,
  netPayoutUsd,
  requestRedemption,
  type PendingRequest,
  type PointsBalance,
} from "../lib/rewards";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { color, gradient, radius, space, type } from "../theme";
import type { IoniconName } from "../types/home";

// Rewards Screen — the User App side of docs/rewards-program.md.
//
// Design note: the Figma frame for this screen (node 4016:192, "Rewards
// Screen") is an empty 375x812 placeholder — it was never drawn, because
// the Figma MCP quota ran out mid-session on 2026-08-30. This is therefore
// built from the conventions of the frames that *were* read: Profile
// Screen's pink->purple header gradient, the white/rounded-12/soft-shadow
// card, and the purple rounded-8 48px CTA from the Redemption Confirmation
// screens. Now that the Figma plan is upgraded (2026-09-02) the frame can
// be drawn; this file is what to reconcile it against.
//
// The "no phone", "below minimum" and "request submitted" cases are states
// of this one screen rather than separate screen components. The Figma file
// draws a separate frame per state, but that's a canvas-organisation
// convention, not an app-structure one — here they share the balance hero
// and differ only below it.

type Nav = NativeStackNavigationProp<RootStackParamList>;

type Phase =
  | { kind: "loading" }
  | { kind: "signed-out" }
  | { kind: "error"; message: string }
  | {
      kind: "ready";
      userId: string;
      balance: PointsBalance;
      pending: PendingRequest | null;
      verificationRequired: boolean;
    }
  | { kind: "submitting"; userId: string; balance: PointsBalance }
  | { kind: "submitted"; balance: PointsBalance }
  | { kind: "rejected"; userId: string; balance: PointsBalance; reason: string };

export function RewardsScreen() {
  const navigation = useNavigation<Nav>();
  const [phase, setPhase] = useState<Phase>({ kind: "loading" });
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setPhase({ kind: "loading" });
    const result = await fetchPointsBalance(supabase);
    if (result.status === "signed-out") {
      setPhase({ kind: "signed-out" });
    } else if (result.status === "error") {
      setPhase({ kind: "error", message: result.message });
    } else {
      const pending = await fetchPendingRequest(supabase);
      setPhase({
        kind: "ready",
        userId: result.userId,
        balance: result.balance,
        pending,
        verificationRequired: result.verificationRequired,
      });
    }
    setRefreshing(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Points arrive from a *shop* verifying a redemption, which happens while
  // this screen is elsewhere in the stack — so re-read on focus rather than
  // only on mount, or a user coming straight back from the QR screen sees a
  // stale balance.
  useFocusEffect(
    useCallback(() => {
      void load(true);
    }, [load])
  );

  const onRedeem = useCallback(async () => {
    if (phase.kind !== "ready" && phase.kind !== "rejected") return;
    const { userId, balance } = phase;
    setPhase({ kind: "submitting", userId, balance });
    const result = await requestRedemption(supabase, userId);
    if (result.status === "submitted") setPhase({ kind: "submitted", balance });
    else setPhase({ kind: "rejected", userId, balance, reason: result.reason });
  }, [phase]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load(true);
            }}
            tintColor={color.purple}
          />
        }
      >
        <View style={styles.titleRow}>
          <Text style={styles.screenTitle}>Rewards</Text>
          <Pressable onPress={() => navigation.navigate("Notifications")} hitSlop={10} accessibilityRole="button">
            <Ionicons name="notifications-outline" size={22} color={color.primaryBlack} />
          </Pressable>
        </View>

        <Body
          phase={phase}
          onRedeem={onRedeem}
          onRetry={() => void load()}
          onVerifyPhone={(phone) => navigation.navigate("VerifyPhone", { phone })}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

function Body({
  phase,
  onRedeem,
  onRetry,
  onVerifyPhone,
}: {
  phase: Phase;
  onRedeem: () => void;
  onRetry: () => void;
  onVerifyPhone: (phone: string) => void;
}) {
  if (phase.kind === "loading") {
    return (
      <View style={styles.centered}>
        <ActivityIndicator color={color.purple} />
      </View>
    );
  }

  if (phase.kind === "signed-out") {
    return (
      <Notice
        icon="lock-closed-outline"
        title="Sign in to see your points"
        body="Points are tied to your account."
      />
    );
  }

  if (phase.kind === "error") {
    return (
      <>
        <Notice icon="alert-circle-outline" title="Couldn't load your points" body={phase.message} tone="danger" />
        <Pressable style={styles.secondaryCta} onPress={onRetry}>
          <Text style={styles.secondaryCtaLabel}>Try again</Text>
        </Pressable>
      </>
    );
  }

  const balance = phase.balance;
  const pending = phase.kind === "ready" ? phase.pending : null;
  const eligible = balance.pointsAvailable >= MIN_POINTS;
  const hasPhone = Boolean(balance.phone && balance.phone.trim());
  // When verification isn't currently required, treat the number as good
  // enough to pay out — the same call the server is making.
  const verificationRequired = phase.kind === "ready" ? phase.verificationRequired : false;
  const needsVerification = verificationRequired && !balance.phoneVerifiedAt;
  const net = netPayoutUsd(balance.availableUsd);
  // An unverified number doesn't block the button — it *redirects* it. The
  // user has the points; verification is the next step of cashing out, not
  // a reason they can't.
  const blocked = !eligible || !hasPhone || Boolean(pending);

  return (
    <>
      <BalanceHero balance={balance} />

      {phase.kind === "submitted" ? (
        <SubmittedCard />
      ) : pending ? (
        <PendingCard pending={pending} />
      ) : (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Cash out your points</Text>
          <Text style={styles.cardBody}>
            Redeeming sends your full available balance of {balance.pointsAvailable}{" "}
            {balance.pointsAvailable === 1 ? "point" : "points"} as one payout. There's no partial cash-out.
          </Text>

          {eligible && (
            <View style={styles.breakdown}>
              <BreakdownRow label="Points value" value={formatUsd(balance.availableUsd)} />
              <BreakdownRow label="Service fee" value={`-${formatUsd(SERVICE_FEE_USD)}`} />
              <View style={styles.breakdownRule} />
              <BreakdownRow label="You receive" value={formatUsd(net)} emphasis />
            </View>
          )}

          {!hasPhone && (
            <Blocker
              icon="call-outline"
              text="Add a phone number on your Profile first — payouts are sent to it by Wish Money, so a request without one can't be created."
            />
          )}
          {hasPhone && !eligible && (
            <Blocker
              icon="trending-up-outline"
              text={`You need at least ${MIN_POINTS} points (${formatUsd(
                MIN_POINTS * USD_PER_POINT
              )}) to cash out. That's ${MIN_POINTS - balance.pointsAvailable} more to go.`}
            />
          )}
          {phase.kind === "rejected" && <Blocker icon="close-circle-outline" text={phase.reason} tone="danger" />}

          {eligible && hasPhone && needsVerification && (
            <Blocker
              icon="shield-checkmark-outline"
              text={`Before we send money we'll text a code to ${balance.phone} to confirm it's yours. The ${formatUsd(
                SERVICE_FEE_USD
              )} service fee covers it — verifying is not an extra charge.`}
            />
          )}

          <Pressable
            style={[styles.cta, (blocked || phase.kind === "submitting") && styles.ctaDisabled]}
            disabled={blocked || phase.kind === "submitting"}
            onPress={() => {
              if (needsVerification && balance.phone) onVerifyPhone(balance.phone);
              else onRedeem();
            }}
          >
            {phase.kind === "submitting" ? (
              <ActivityIndicator color={color.white} />
            ) : (
              <Text style={styles.ctaLabel}>
                {needsVerification ? "Verify number & redeem" : `Redeem ${formatUsd(net)}`}
              </Text>
            )}
          </Pressable>

          <Text style={styles.disclosure}>
            Payouts are sent manually to your phone number via Wish Money, less a {formatUsd(SERVICE_FEE_USD)} service
            fee per request. Redemption takes 24 to 72 hours, weekdays only.
          </Text>
        </View>
      )}

      <View style={styles.statsRow}>
        <Stat label="Points earned" value={String(balance.pointsEarned)} />
        <Stat label="Redemptions" value={String(balance.redemptionCount)} />
      </View>

      <Text style={styles.footnote}>
        You earn 1 point ({formatUsd(USD_PER_POINT)}) each time a shop verifies one of your redemptions.
      </Text>
    </>
  );
}

function BalanceHero({ balance }: { balance: PointsBalance }) {
  return (
    <LinearGradient
      colors={[gradient.balanceHero[0], gradient.balanceHero[1]]}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
      style={styles.hero}
    >
      <Text style={styles.heroLabel}>Available balance</Text>
      <Text style={styles.heroBalance}>{balance.pointsAvailable}</Text>
      <Text style={styles.heroUsd}>
        {balance.pointsAvailable === 1 ? "point" : "points"} · {formatUsd(balance.availableUsd)}
      </Text>
    </LinearGradient>
  );
}

function PendingCard({ pending }: { pending: PendingRequest }) {
  return (
    <View style={[styles.card, styles.cardPending]}>
      <Ionicons name="hourglass-outline" size={28} color={color.purple} />
      <Text style={styles.cardTitle}>Payout in progress</Text>
      <Text style={styles.cardBody}>
        {formatUsd(pending.netUsdAmount)} is being sent to {pending.phoneNumber} — {pending.pointsRequested} points
        ({formatUsd(pending.usdAmount)}) less the {formatUsd(pending.serviceFeeUsd)} service fee. Redemption takes 24
        to 72 hours, weekdays only.
      </Text>
      <Text style={styles.disclosure}>
        Those points are held while this is processed, which is why your balance reads lower. If the request is
        declined they go straight back.
      </Text>
    </View>
  );
}

function SubmittedCard() {
  return (
    <View style={[styles.card, styles.cardSuccess]}>
      <Ionicons name="checkmark-circle" size={32} color={color.success} />
      <Text style={styles.cardTitle}>Request received</Text>
      <Text style={styles.cardBody}>
        We'll send your payout to the phone number on your profile. Redemption takes 24 to 72 hours, weekdays only.
      </Text>
      <Text style={styles.disclosure}>
        We'll notify you here the moment it's sent. Your points are held until then; if it's rejected, they go straight
        back to your balance and the service fee is not charged.
      </Text>
    </View>
  );
}

function Blocker({ icon, text, tone }: { icon: IoniconName; text: string; tone?: "danger" }) {
  return (
    <View style={styles.blocker}>
      <Ionicons name={icon} size={18} color={tone === "danger" ? color.danger : color.purple} />
      <Text style={[styles.blockerText, tone === "danger" && styles.blockerTextDanger]}>{text}</Text>
    </View>
  );
}

function Notice({ icon, title, body, tone }: { icon: IoniconName; title: string; body: string; tone?: "danger" }) {
  return (
    <View style={styles.card}>
      <Ionicons name={icon} size={28} color={tone === "danger" ? color.danger : color.purple} />
      <Text style={styles.cardTitle}>{title}</Text>
      <Text style={styles.cardBody}>{body}</Text>
    </View>
  );
}

function BreakdownRow({ label, value, emphasis }: { label: string; value: string; emphasis?: boolean }) {
  return (
    <View style={styles.breakdownRow}>
      <Text style={[styles.breakdownLabel, emphasis && styles.breakdownStrong]}>{label}</Text>
      <Text style={[styles.breakdownValue, emphasis && styles.breakdownStrong]}>{value}</Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.white },
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 110, gap: space.lg },
  titleRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  screenTitle: { ...type.sectionTitle, color: color.primaryBlack },
  centered: { paddingVertical: space.xl * 2, alignItems: "center" },

  hero: {
    borderRadius: radius.md,
    paddingVertical: space.xl,
    paddingHorizontal: space.lg,
    alignItems: "center",
    gap: space.xs,
  },
  heroLabel: { ...type.heroLabel, color: color.white, opacity: 0.9 },
  heroBalance: { ...type.heroBalance, color: color.white },
  heroUsd: { ...type.heroUsd, color: color.white, opacity: 0.95 },

  card: {
    backgroundColor: color.white,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.sm,
    shadowColor: color.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  cardSuccess: { backgroundColor: color.successBg },
  cardPending: { backgroundColor: color.placeholderBg },
  cardTitle: { ...type.cardTitleStrong, color: color.primaryBlack },
  cardBody: { ...type.cardTitle, color: color.textMuted },

  breakdown: { gap: 6, paddingVertical: space.xs },
  breakdownRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "baseline" },
  breakdownLabel: { ...type.caption, color: color.textMuted },
  breakdownValue: { ...type.caption, color: color.primaryBlack },
  breakdownStrong: { ...type.cardTitleStrong, color: color.primaryBlack },
  breakdownRule: { height: 1, backgroundColor: color.divider, marginVertical: 2 },

  blocker: { flexDirection: "row", gap: space.sm, alignItems: "flex-start", paddingTop: space.xs },
  blockerText: { ...type.disclosure, color: color.textMuted, flex: 1 },
  blockerTextDanger: { color: color.danger },

  cta: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: color.purple,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.sm,
  },
  ctaDisabled: { backgroundColor: color.disabled },
  ctaLabel: { ...type.ctaLabel, color: color.white },

  secondaryCta: { height: 48, alignItems: "center", justifyContent: "center" },
  secondaryCtaLabel: { ...type.ctaLabel, color: color.purple },

  disclosure: { ...type.disclosure, color: color.textMuted },
  footnote: { ...type.disclosure, color: color.textMuted, textAlign: "center" },

  statsRow: { flexDirection: "row", gap: space.md },
  stat: {
    flex: 1,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.divider,
    paddingVertical: space.md,
    alignItems: "center",
    gap: space.xs,
  },
  statValue: { ...type.cardTitleStrong, color: color.primaryBlack },
  statLabel: { ...type.caption, color: color.textMuted },
});
