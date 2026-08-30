import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";
import { loadActiveStaff, type ActiveStaff } from "./src/lib/session";
import { LoginScreen } from "./src/screens/LoginScreen";
import { RedeemScreen } from "./src/screens/RedeemScreen";
import { ReportsScreen } from "./src/screens/ReportsScreen";
import { BottomNav, type NavKey } from "./src/components/BottomNav";
import { color } from "./src/theme";

type Phase = "loading" | "login" | "ready";

export default function App() {
  const [phase, setPhase] = useState<Phase>("loading");
  const [staff, setStaff] = useState<ActiveStaff | null>(null);
  const [loginError, setLoginError] = useState<string | null>(null);
  const [tab, setTab] = useState<NavKey>("redeem");

  useEffect(() => {
    let cancelled = false;

    async function resolve(session: Session | null) {
      if (!session) {
        if (!cancelled) {
          setStaff(null);
          setPhase("login");
        }
        return;
      }

      // A Supabase Auth login isn't enough on its own — only an *active*
      // shop_staff row makes this account usable here (see
      // src/lib/session.ts). A login that fails that check is signed back
      // out immediately with a plain-language reason, matching what
      // verify-redemption would reject them for anyway.
      const result = await loadActiveStaff(supabase);
      if (cancelled) return;
      if (result.staff) {
        setStaff(result.staff);
        setLoginError(null);
        setPhase("ready");
      } else {
        setLoginError(result.reason);
        setStaff(null);
        setPhase("login");
        await supabase.auth.signOut();
      }
    }

    supabase.auth.getSession().then(({ data }) => resolve(data.session));
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => resolve(session));

    return () => {
      cancelled = true;
      subscription.subscription.unsubscribe();
    };
  }, []);

  async function handleSignOut() {
    await supabase.auth.signOut();
    setTab("redeem");
  }

  return (
    <SafeAreaProvider>
      {phase === "loading" && (
        <View style={styles.loading}>
          <ActivityIndicator color={color.purple} size="large" />
        </View>
      )}

      {phase === "login" && <LoginScreen externalError={loginError} />}

      {phase === "ready" && staff && (
        <View style={styles.flex}>
          <View style={styles.flex}>
            {tab === "redeem" ? <RedeemScreen staff={staff} /> : <ReportsScreen />}
          </View>
          <BottomNav active={tab} onChange={setTab} onSignOut={handleSignOut} />
        </View>
      )}

      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.background },
});
