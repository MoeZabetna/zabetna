import { useEffect, useState } from "react";
import { ActivityIndicator, FlatList, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { supabase } from "../lib/supabase";
import {
  fetchMonthlyReport,
  fetchRangeReport,
  formatMonthLabel,
  formatUsd,
  type MonthlyBucket,
  type RangeReport,
} from "../lib/reports";
import { color, radius, space, type } from "../theme";

type Tab = "range" | "monthly";

function startOfMonth(): Date {
  const d = new Date();
  d.setDate(1);
  return d;
}

export function ReportsScreen() {
  const [tab, setTab] = useState<Tab>("range");

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.title}>Reports</Text>
      </View>

      <View style={styles.tabs}>
        <Pressable onPress={() => setTab("range")} style={[styles.tab, tab === "range" && styles.tabActive]}>
          <Text style={[styles.tabLabel, tab === "range" && styles.tabLabelActive]}>Custom range</Text>
        </Pressable>
        <Pressable onPress={() => setTab("monthly")} style={[styles.tab, tab === "monthly" && styles.tabActive]}>
          <Text style={[styles.tabLabel, tab === "monthly" && styles.tabLabelActive]}>Monthly</Text>
        </Pressable>
      </View>

      {tab === "range" ? <RangeReportView /> : <MonthlyReportView />}
    </SafeAreaView>
  );
}

function DateField({ label, value, onChange }: { label: string; value: Date; onChange: (d: Date) => void }) {
  const [show, setShow] = useState(false);

  return (
    <View style={styles.dateField}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <Pressable onPress={() => setShow(true)} style={styles.dateButton}>
        <Ionicons name="calendar-outline" size={16} color={color.inkMuted} />
        <Text style={styles.dateButtonText}>{value.toLocaleDateString("en-US", { day: "numeric", month: "short", year: "numeric" })}</Text>
      </Pressable>
      {show && (
        <DateTimePicker
          value={value}
          mode="date"
          maximumDate={new Date()}
          display={Platform.OS === "ios" ? "inline" : "default"}
          onValueChange={(_event, date) => {
            if (Platform.OS === "android") setShow(false);
            if (date) onChange(date);
          }}
          onDismiss={() => setShow(false)}
        />
      )}
      {show && Platform.OS === "ios" && (
        <Pressable onPress={() => setShow(false)} style={styles.dateDoneButton}>
          <Text style={styles.dateDoneText}>Done</Text>
        </Pressable>
      )}
    </View>
  );
}

function RangeReportView() {
  const [from, setFrom] = useState<Date>(startOfMonth());
  const [to, setTo] = useState<Date>(new Date());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<RangeReport | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchRangeReport(supabase, from, to)
      .then((r) => {
        if (!cancelled) setReport(r);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load the report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [from, to]);

  return (
    <View style={styles.body}>
      <View style={styles.dateRow}>
        <DateField label="From" value={from} onChange={setFrom} />
        <DateField label="To" value={to} onChange={setTo} />
      </View>

      {loading && (
        <View style={styles.centerPad}>
          <ActivityIndicator color={color.purple} />
        </View>
      )}

      {error && <Text style={styles.errorText}>{error}</Text>}

      {!loading && !error && report && (
        <>
          <View style={styles.summaryRow}>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{report.count}</Text>
              <Text style={styles.summaryLabel}>Redemptions</Text>
            </View>
            <View style={styles.summaryCard}>
              <Text style={styles.summaryValue}>{formatUsd(report.totalUsd)}</Text>
              <Text style={styles.summaryLabel}>Amount owed to Zabetna</Text>
            </View>
          </View>

          <Text style={styles.listCaption}>
            {report.count === 0 ? "No verified redemptions in this range." : "Verified redemptions in this range"}
          </Text>
          <FlatList
            data={report.rows}
            keyExtractor={(r) => r.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <View style={styles.listRow}>
                <Text style={styles.listRowDate}>
                  {item.verifiedAtBeirut
                    ? new Date(`${item.verifiedAtBeirut}Z`).toLocaleString("en-US", {
                        dateStyle: "medium",
                        timeStyle: "short",
                        timeZone: "UTC",
                      })
                    : "—"}
                </Text>
                <Text style={styles.listRowFee}>{formatUsd(item.feeUsd)}</Text>
              </View>
            )}
          />
        </>
      )}
    </View>
  );
}

function MonthlyReportView() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [buckets, setBuckets] = useState<MonthlyBucket[]>([]);

  useEffect(() => {
    let cancelled = false;
    fetchMonthlyReport(supabase, 12)
      .then((b) => {
        if (!cancelled) setBuckets(b);
      })
      .catch((e) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Couldn't load the report.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <View style={styles.centerPad}>
        <ActivityIndicator color={color.purple} />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.body}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <View style={styles.body}>
      <Text style={styles.listCaption}>Last 12 months</Text>
      <FlatList
        data={buckets}
        keyExtractor={(b) => b.month}
        ListEmptyComponent={<Text style={styles.emptyText}>No verified redemptions yet.</Text>}
        contentContainerStyle={styles.listContent}
        renderItem={({ item }) => (
          <View style={styles.monthRow}>
            <View>
              <Text style={styles.monthLabel}>{formatMonthLabel(item.month)}</Text>
              <Text style={styles.monthCount}>{item.count} redemption{item.count === 1 ? "" : "s"}</Text>
            </View>
            <Text style={styles.monthTotal}>{formatUsd(item.totalUsd)}</Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm },
  title: { ...type.heading, color: color.ink },
  tabs: { flexDirection: "row", paddingHorizontal: space.lg, gap: space.sm, marginTop: space.md, marginBottom: space.sm },
  tab: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  tabActive: { borderColor: color.purple, backgroundColor: color.purpleFaint },
  tabLabel: { ...type.label, color: color.inkMuted },
  tabLabelActive: { color: color.purple },
  body: { flex: 1, paddingHorizontal: space.lg },
  dateRow: { flexDirection: "row", gap: space.md, marginBottom: space.md },
  dateField: { flex: 1 },
  fieldLabel: { ...type.label, color: color.inkMuted, marginBottom: space.xs },
  dateButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.xs,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
  },
  dateButtonText: { ...type.body, color: color.ink },
  dateDoneButton: { alignSelf: "flex-end", paddingVertical: space.xs, paddingHorizontal: space.sm },
  dateDoneText: { ...type.label, color: color.purple },
  centerPad: { paddingVertical: space.xl, alignItems: "center" },
  errorText: { ...type.body, color: color.danger, marginTop: space.md },
  summaryRow: { flexDirection: "row", gap: space.md, marginBottom: space.md },
  summaryCard: {
    flex: 1,
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    alignItems: "center",
  },
  summaryValue: { fontSize: 24, fontWeight: "700", color: color.purple },
  summaryLabel: { ...type.caption, color: color.inkMuted, marginTop: space.xs, textAlign: "center" },
  listCaption: { ...type.label, color: color.inkMuted, marginBottom: space.sm },
  listContent: { paddingBottom: space.xl },
  listRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: color.border,
  },
  listRowDate: { ...type.body, color: color.ink },
  listRowFee: { ...type.body, color: color.inkMuted, fontVariant: ["tabular-nums"] },
  emptyText: { ...type.body, color: color.inkMuted, textAlign: "center", paddingVertical: space.xl },
  monthRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    marginBottom: space.sm,
  },
  monthLabel: { ...type.body, color: color.ink, fontWeight: "600" },
  monthCount: { ...type.caption, color: color.inkMuted, marginTop: 2 },
  monthTotal: { fontSize: 17, fontWeight: "700", color: color.purple, fontVariant: ["tabular-nums"] },
});
