import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { supabase } from "../lib/supabase";
import { fetchNotifications, markNotificationsRead, type AppNotification } from "../lib/notifications";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { color, radius, space, type } from "../theme";
import type { IoniconName } from "../types/home";

// The in-app notification inbox. This is the guarantee behind
// docs/rewards-program.md gap 2 ("users get a notification that points
// redeem"): rows are written by a database trigger in the same transaction
// as the payout confirmation, so even if push never fires, the message is
// here the next time the app opens.

type Props = NativeStackScreenProps<RootStackParamList, "Notifications">;

const ICONS: Record<AppNotification["kind"], IoniconName> = {
  reward_confirmed: "cash-outline",
  reward_rejected: "close-circle-outline",
  points_earned: "star-outline",
};

const TINTS: Record<AppNotification["kind"], string> = {
  reward_confirmed: color.success,
  reward_rejected: color.danger,
  points_earned: color.purple,
};

export function NotificationsScreen({ navigation }: Props) {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const rows = await fetchNotifications(supabase);
      setItems(rows);
      setError(null);

      // Mark everything visible as read once it's been rendered. Done after
      // the fetch rather than on each row's press: opening the inbox *is*
      // reading them, and per-row read tracking isn't something the design
      // asks for.
      const unread = rows.filter((r) => r.readAt === null).map((r) => r.id);
      if (unread.length > 0) await markNotificationsRead(supabase, unread);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load notifications.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={color.primaryBlack} />
        </Pressable>
        <Text style={styles.headerTitle}>Notifications</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={color.purple}
          />
        }
      >
        {loading ? (
          <ActivityIndicator color={color.purple} style={styles.spinner} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="notifications-outline" size={48} color={color.placeholderIcon} />
            <Text style={styles.emptyText}>Nothing yet. You'll hear from us when you earn points or a payout is sent.</Text>
          </View>
        ) : (
          items.map((item) => (
            <View key={item.id} style={[styles.row, item.readAt === null && styles.rowUnread]}>
              <Ionicons name={ICONS[item.kind]} size={22} color={TINTS[item.kind]} />
              <View style={styles.rowBody}>
                <Text style={styles.rowTitle}>{item.title}</Text>
                <Text style={styles.rowText}>{item.body}</Text>
                <Text style={styles.rowTime}>{formatWhen(item.createdAt)}</Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function formatWhen(iso: string): string {
  const then = new Date(iso).getTime();
  const minutes = Math.round((Date.now() - then) / 60000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days} day${days === 1 ? "" : "s"} ago`;
  return new Date(iso).toLocaleDateString();
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.white },
  header: { flexDirection: "row", alignItems: "center", gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.sm },
  headerTitle: { ...type.sectionTitle, color: color.primaryBlack },
  content: { paddingHorizontal: space.lg, paddingBottom: 40, gap: space.sm },
  spinner: { marginTop: space.xl },
  error: { ...type.cardTitle, color: color.danger },
  empty: { alignItems: "center", gap: space.sm, paddingVertical: space.xl * 2 },
  emptyText: { ...type.cardTitle, color: color.textMuted, textAlign: "center" },
  row: {
    flexDirection: "row",
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.divider,
  },
  rowUnread: { backgroundColor: color.placeholderBg, borderColor: "transparent" },
  rowBody: { flex: 1, gap: 2 },
  rowTitle: { ...type.cardTitleStrong, color: color.primaryBlack },
  rowText: { ...type.caption, color: color.textMuted },
  rowTime: { ...type.disclosure, color: color.textMuted, marginTop: 2 },
});
