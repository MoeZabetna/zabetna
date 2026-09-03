import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import * as Notifications from "expo-notifications";
import {
  useFonts,
  Poppins_400Regular,
  Poppins_500Medium,
  Poppins_600SemiBold,
  Poppins_700Bold,
} from "@expo-google-fonts/poppins";
import { AuthProvider, useAuth } from "./src/lib/auth";
import { registerForPush } from "./src/lib/notifications";
import { supabase } from "./src/lib/supabase";
import { RootNavigator } from "./src/navigation/RootNavigator";
import { color } from "./src/theme";

// Foreground presentation. `shouldShowAlert` is deprecated in SDK 57 —
// banner and list are separate switches now
// (https://docs.expo.dev/versions/v57.0.0/sdk/notifications/).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/**
 * Registers this device for push once there's a session to attach the token
 * to, and clears the badge when the app is opened from a notification.
 *
 * Deliberately silent about failure: `registerForPush` returns a `skipped`
 * reason for every normal case (simulator, permission declined, no EAS
 * project yet), and none of those are worth interrupting the user for. The
 * in-app inbox works regardless.
 */
function PushRegistration() {
  const { session } = useAuth();

  useEffect(() => {
    if (!session) return;
    void registerForPush(supabase);
  }, [session]);

  useEffect(() => {
    const subscription = Notifications.addNotificationResponseReceivedListener(() => {
      void Notifications.setBadgeCountAsync(0);
    });
    return () => subscription.remove();
  }, []);

  return null;
}

export default function App() {
  const [fontsLoaded] = useFonts({
    Poppins_400Regular,
    Poppins_500Medium,
    Poppins_600SemiBold,
    Poppins_700Bold,
  });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={color.purple} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <AuthProvider>
        <PushRegistration />
        <RootNavigator />
      </AuthProvider>
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.white },
});
