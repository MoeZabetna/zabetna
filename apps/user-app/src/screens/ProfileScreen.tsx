import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { TextField } from "../components/TextField";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { fetchPointsBalance, formatUsd, type PointsBalance } from "../lib/rewards";
import { unregisterPush } from "../lib/notifications";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { color, gradient, radius, space, type } from "../theme";

// Profile Screen — Figma node 70:2140. Gradient header (the same
// pink->purple pair the Rewards hero uses), then account details and the
// redemption overview card.
//
// The phone number is editable here on purpose: it is the payout
// destination, `set_reward_request_amounts()` refuses a payout without one,
// and a user who signed up before caring about rewards needs somewhere to
// add it. It is also UNIQUE, so a clash is reported rather than swallowed.

type Nav = NativeStackNavigationProp<RootStackParamList>;

export function ProfileScreen() {
  const navigation = useNavigation<Nav>();
  const { session, signOut } = useAuth();
  const [balance, setBalance] = useState<PointsBalance | null>(null);
  const [loading, setLoading] = useState(true);
  const [phone, setPhone] = useState("");
  const [fullName, setFullName] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  const load = useCallback(async () => {
    const result = await fetchPointsBalance(supabase);
    if (result.status === "ok") {
      setBalance(result.balance);
      setPhone(result.balance.phone ?? "");
      setFullName(result.balance.fullName ?? "");
    }

    const { count } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .is("read_at", null);
    setUnreadCount(count ?? 0);

    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onSave = useCallback(async () => {
    setSaving(true);
    setSaveError(null);
    setSaved(false);

    const { error } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim() || null, phone: phone.trim() || null })
      .eq("id", session?.user.id ?? "");

    setSaving(false);
    if (error) {
      // 23505 is a unique violation — the only one this form can cause is
      // a phone number already registered to someone else.
      setSaveError(
        error.code === "23505"
          ? "That phone number is already registered to another account."
          : error.message
      );
      return;
    }
    setSaved(true);
    void load();
  }, [fullName, phone, session, load]);

  const onSignOut = useCallback(() => {
    Alert.alert("Sign out", "You'll need to sign in again to see your points.", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Sign out",
        style: "destructive",
        onPress: async () => {
          // Drop this device's push token first: a signed-out phone should
          // stop receiving another account's payout notifications.
          await unregisterPush(supabase);
          await signOut();
        },
      },
    ]);
  }, [signOut]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={[gradient.balanceHero[0], gradient.balanceHero[1]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroName}>{balance?.fullName || "Your profile"}</Text>
          <Text style={styles.heroEmail}>{session?.user.email}</Text>
        </LinearGradient>

        <Pressable style={styles.linkRow} onPress={() => navigation.navigate("Notifications")}>
          <Ionicons name="notifications-outline" size={20} color={color.purple} />
          <Text style={styles.linkLabel}>Notifications</Text>
          {unreadCount > 0 && (
            <View style={styles.badge}>
              <Text style={styles.badgeText}>{unreadCount}</Text>
            </View>
          )}
          <Ionicons name="chevron-forward" size={18} color={color.textMuted} />
        </Pressable>

        {loading ? (
          <ActivityIndicator color={color.purple} style={styles.spinner} />
        ) : (
          <>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Redemption overview</Text>
              <View style={styles.statsRow}>
                <Stat label="Points" value={String(balance?.pointsAvailable ?? 0)} />
                <Stat label="Value" value={formatUsd(balance?.availableUsd ?? 0)} />
                <Stat label="Redemptions" value={String(balance?.redemptionCount ?? 0)} />
              </View>
            </View>

            <View style={styles.card}>
              <Text style={styles.cardTitle}>Account details</Text>
              <TextField label="Name" value={fullName} onChangeText={setFullName} autoCapitalize="words" />
              <TextField
                label="Phone number"
                icon="call-outline"
                value={phone}
                onChangeText={(v) => {
                  setPhone(v);
                  setSaved(false);
                }}
                keyboardType="phone-pad"
                placeholder="Add a phone number"
                error={saveError}
              />
              <Text style={styles.hint}>
                Reward payouts are sent to this number via Wish Money. You'll confirm it by SMS the first time you cash
                out — changing it here means confirming the new number next time.
              </Text>
              <Pressable style={styles.saveCta} onPress={onSave} disabled={saving}>
                {saving ? (
                  <ActivityIndicator color={color.white} />
                ) : (
                  <Text style={styles.saveLabel}>{saved ? "Saved" : "Save changes"}</Text>
                )}
              </Pressable>
            </View>

            <Pressable style={styles.signOut} onPress={onSignOut}>
              <Ionicons name="log-out-outline" size={20} color={color.danger} />
              <Text style={styles.signOutLabel}>Sign out</Text>
            </Pressable>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
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
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 110, gap: space.md },
  hero: { borderRadius: radius.md, padding: space.lg, gap: space.xs },
  heroName: { ...type.sectionTitle, color: color.white, textTransform: "none" },
  heroEmail: { ...type.caption, color: color.white, opacity: 0.9 },
  spinner: { marginTop: space.xl },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.divider,
  },
  linkLabel: { ...type.cardTitleStrong, color: color.primaryBlack, flex: 1 },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    backgroundColor: color.purple,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: { ...type.disclosure, color: color.white },
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
  cardTitle: { ...type.cardTitleStrong, color: color.primaryBlack },
  statsRow: { flexDirection: "row", gap: space.md },
  stat: { flex: 1, alignItems: "center", gap: 2 },
  statValue: { ...type.cardTitleStrong, color: color.purple },
  statLabel: { ...type.caption, color: color.textMuted },
  hint: { ...type.disclosure, color: color.textMuted },
  saveCta: {
    height: 48,
    borderRadius: radius.sm,
    backgroundColor: color.purple,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.xs,
  },
  saveLabel: { ...type.ctaLabel, color: color.white },
  signOut: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: space.sm, paddingVertical: space.md },
  signOutLabel: { ...type.ctaLabel, color: color.danger },
});
