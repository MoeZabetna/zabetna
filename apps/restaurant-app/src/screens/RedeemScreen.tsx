import { useCallback, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import { Ionicons } from "@expo/vector-icons";
import { verifyRedemption, type VerifyRedemptionResult } from "@zabetna/api-client";
import { supabase } from "../lib/supabase";
import type { ActiveStaff } from "../lib/session";
import { color, radius, space, type } from "../theme";

type Mode = "scan" | "manual";
type Outcome = { result: VerifyRedemptionResult } | { errorMessage: string };

// redemptions.token is a 32-character hex string — the same value encoded
// in the QR and shown to the customer for manual entry. It's not a
// friendly code to type under pressure at a register, but that's a
// cross-app schema decision from an earlier build (the User App's QR also
// encodes this token) — not something to change unilaterally while just
// building the redeem screen. Worth raising with Mo separately. What this
// screen *can* do: strip whitespace/dashes and lowercase what's typed, so
// small formatting slips don't cause a false "unrecognized code".
function normalizeManualToken(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]/g, "");
}

export function RedeemScreen({ staff }: { staff: ActiveStaff }) {
  const [mode, setMode] = useState<Mode>("scan");
  const [permission, requestPermission] = useCameraPermissions();
  const [manualToken, setManualToken] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const scanLockRef = useRef(false);

  const runVerify = useCallback(async (token: string) => {
    setVerifying(true);
    setOutcome(null);
    try {
      const result = await verifyRedemption(supabase, token);
      setOutcome({ result });
    } catch (e) {
      setOutcome({ errorMessage: e instanceof Error ? e.message : "Couldn't reach Zabetna — check your connection." });
    } finally {
      setVerifying(false);
    }
  }, []);

  function handleBarcodeScanned(scan: BarcodeScanningResult) {
    // onBarcodeScanned keeps firing repeatedly while a code sits in frame;
    // without this lock the same code would trigger runVerify() dozens of
    // times before the staff member can pull the camera away.
    if (scanLockRef.current) return;
    scanLockRef.current = true;
    runVerify(scan.data);
  }

  function reset() {
    setOutcome(null);
    setManualToken("");
    scanLockRef.current = false;
  }

  function switchMode(next: Mode) {
    reset();
    setMode(next);
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.shopName}>{staff.shopName}</Text>
        <Text style={styles.staffName}>{staff.fullName}</Text>
      </View>

      <View style={styles.tabs}>
        <ModeTab label="Scan QR" icon="qr-code-outline" active={mode === "scan"} onPress={() => switchMode("scan")} />
        <ModeTab label="Enter code" icon="keypad-outline" active={mode === "manual"} onPress={() => switchMode("manual")} />
      </View>

      <View style={styles.body}>
        {outcome ? (
          <ResultCard outcome={outcome} onDismiss={reset} />
        ) : mode === "scan" ? (
          <ScanPane
            permission={permission}
            requestPermission={requestPermission}
            verifying={verifying}
            onScanned={handleBarcodeScanned}
          />
        ) : (
          <ManualPane
            value={manualToken}
            onChangeText={setManualToken}
            verifying={verifying}
            onSubmit={() => {
              const token = normalizeManualToken(manualToken);
              if (token) runVerify(token);
            }}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

function ModeTab({
  label,
  icon,
  active,
  onPress,
}: {
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable onPress={onPress} style={[styles.tab, active && styles.tabActive]}>
      <Ionicons name={icon} size={16} color={active ? color.purple : color.inkMuted} />
      <Text style={[styles.tabLabel, active && styles.tabLabelActive]}>{label}</Text>
    </Pressable>
  );
}

function ScanPane({
  permission,
  requestPermission,
  verifying,
  onScanned,
}: {
  permission: ReturnType<typeof useCameraPermissions>[0];
  requestPermission: () => void;
  verifying: boolean;
  onScanned: (scan: BarcodeScanningResult) => void;
}) {
  if (!permission) {
    return (
      <View style={styles.centerPane}>
        <ActivityIndicator color={color.purple} />
      </View>
    );
  }

  if (!permission.granted) {
    return (
      <View style={styles.centerPane}>
        <Ionicons name="camera-outline" size={40} color={color.inkMuted} />
        <Text style={styles.permissionText}>
          {permission.canAskAgain
            ? "Camera access is needed to scan redemption codes."
            : "Camera access was denied. Enable it for Zabetna in your device Settings."}
        </Text>
        {permission.canAskAgain && (
          <Pressable onPress={requestPermission} style={styles.button}>
            <Text style={styles.buttonText}>Allow camera</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <View style={styles.cameraWrap}>
      <CameraView
        style={StyleSheet.absoluteFill}
        facing="back"
        barcodeScannerSettings={{ barcodeTypes: ["qr"] }}
        onBarcodeScanned={onScanned}
      />
      <View style={styles.scanFrame} pointerEvents="none" />
      {verifying && (
        <View style={styles.scanOverlay}>
          <ActivityIndicator color={color.surface} size="large" />
        </View>
      )}
      <Text style={styles.scanHint}>Point the camera at the customer&apos;s QR code</Text>
    </View>
  );
}

function ManualPane({
  value,
  onChangeText,
  verifying,
  onSubmit,
}: {
  value: string;
  onChangeText: (v: string) => void;
  verifying: boolean;
  onSubmit: () => void;
}) {
  return (
    <View style={styles.manualPane}>
      <Text style={styles.fieldLabel}>Redemption code</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        autoCorrect={false}
        placeholder="e.g. 4a1f9c2e0b7d3e5f8a1c6d9b0e2f4a7c"
        placeholderTextColor={color.inkFaint}
        style={styles.manualInput}
        onSubmitEditing={onSubmit}
      />
      <Pressable
        onPress={onSubmit}
        disabled={verifying || !value.trim()}
        style={({ pressed }) => [
          styles.button,
          (pressed || verifying || !value.trim()) && styles.buttonPressed,
          { marginTop: space.md },
        ]}
      >
        {verifying ? <ActivityIndicator color={color.surface} /> : <Text style={styles.buttonText}>Verify code</Text>}
      </Pressable>
    </View>
  );
}

function ResultCard({ outcome, onDismiss }: { outcome: Outcome; onDismiss: () => void }) {
  const isError = "errorMessage" in outcome;
  const verified = !isError && outcome.result.status === "verified";
  const message = isError
    ? outcome.errorMessage
    : outcome.result.status === "verified"
      ? outcome.result.offerTitle
      : outcome.result.reason;

  return (
    <View style={styles.centerPane}>
      <View style={[styles.resultBadge, verified ? styles.resultBadgeSuccess : styles.resultBadgeDanger]}>
        <Ionicons name={verified ? "checkmark-circle" : "close-circle"} size={48} color={color.surface} />
      </View>
      <Text style={styles.resultTitle}>{verified ? "Verified" : "Not redeemed"}</Text>
      <Text style={styles.resultMessage}>{message}</Text>
      <Pressable onPress={onDismiss} style={[styles.button, { marginTop: space.lg }]}>
        <Text style={styles.buttonText}>{verified ? "Scan next" : "Try again"}</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.background },
  header: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.md },
  shopName: { ...type.heading, color: color.ink },
  staffName: { ...type.caption, color: color.inkMuted, marginTop: 2 },
  tabs: { flexDirection: "row", paddingHorizontal: space.lg, gap: space.sm, marginBottom: space.md },
  tab: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: space.xs,
    paddingVertical: 10,
    borderRadius: radius.sm,
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
  },
  tabActive: { borderColor: color.purple, backgroundColor: color.purpleFaint },
  tabLabel: { ...type.label, color: color.inkMuted },
  tabLabelActive: { color: color.purple },
  body: { flex: 1, paddingHorizontal: space.lg, paddingBottom: space.lg },
  centerPane: { flex: 1, alignItems: "center", justifyContent: "center", paddingHorizontal: space.lg },
  permissionText: { ...type.body, color: color.inkMuted, textAlign: "center", marginTop: space.md, marginBottom: space.lg },
  cameraWrap: { flex: 1, borderRadius: radius.lg, overflow: "hidden", backgroundColor: "#000" },
  scanFrame: {
    position: "absolute",
    top: "25%",
    left: "15%",
    right: "15%",
    bottom: "35%",
    borderWidth: 3,
    borderColor: color.surface,
    borderRadius: radius.md,
  },
  scanOverlay: {
    ...StyleSheet.absoluteFill,
    backgroundColor: "rgba(0,0,0,0.45)",
    alignItems: "center",
    justifyContent: "center",
  },
  scanHint: {
    position: "absolute",
    bottom: space.lg,
    alignSelf: "center",
    color: color.surface,
    backgroundColor: "rgba(0,0,0,0.55)",
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.sm,
    ...type.caption,
  },
  manualPane: { paddingTop: space.lg },
  fieldLabel: { ...type.label, color: color.inkMuted, marginBottom: space.xs },
  manualInput: {
    backgroundColor: color.surface,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: 12,
    fontSize: 16,
    color: color.ink,
    fontFamily: "monospace" as const,
  },
  button: {
    backgroundColor: color.purple,
    borderRadius: radius.sm,
    paddingVertical: 14,
    paddingHorizontal: space.lg,
    alignItems: "center",
  },
  buttonPressed: { opacity: 0.6 },
  buttonText: { ...type.heading, color: color.surface },
  resultBadge: { width: 88, height: 88, borderRadius: 44, alignItems: "center", justifyContent: "center" },
  resultBadgeSuccess: { backgroundColor: color.success },
  resultBadgeDanger: { backgroundColor: color.danger },
  resultTitle: { ...type.title, color: color.ink, marginTop: space.md },
  resultMessage: { ...type.body, color: color.inkMuted, textAlign: "center", marginTop: space.xs },
});
