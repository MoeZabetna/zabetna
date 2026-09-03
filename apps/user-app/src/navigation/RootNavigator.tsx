import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { NavigationContainer, type NavigatorScreenParams } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { BrandLogo } from "../components/BrandLogo";
import { useAuth } from "../lib/auth";
import { SignInScreen } from "../screens/auth/SignInScreen";
import { SignUpScreen } from "../screens/auth/SignUpScreen";
import { MainTabs, type TabParamList } from "./MainTabs";
import { ShopDetailScreen } from "../screens/ShopDetailScreen";
import { RedeemScreen } from "../screens/RedeemScreen";
import { NotificationsScreen } from "../screens/NotificationsScreen";
import { VerifyPhoneScreen } from "../screens/VerifyPhoneScreen";
import { color } from "../theme";

/**
 * Two stacks, chosen by whether there is a session — the standard React
 * Navigation auth pattern. Swapping the whole navigator (rather than
 * navigating to a login route) means a signed-out user has no back stack
 * into the app, and a signed-in one has none back into the auth screens.
 */

export type RootStackParamList = {
  Tabs: NavigatorScreenParams<TabParamList> | undefined;
  ShopDetail: { shopId: string; shopName: string };
  Redeem: { offerId: string; offerTitle: string; shopName: string };
  Notifications: undefined;
  /** Payout-time OTP. `phone` is the number the code is sent to. */
  VerifyPhone: { phone: string };
};

const RootStack = createNativeStackNavigator<RootStackParamList>();
const AuthStack = createNativeStackNavigator<{ SignIn: undefined; SignUp: undefined }>();

function AuthFlow() {
  // Sign in / Sign up push each other rather than living in a tab set,
  // matching the design's "Don't have an account / Sign Up" link pairing.
  const [start] = useState<"SignIn">("SignIn");
  return (
    <AuthStack.Navigator initialRouteName={start} screenOptions={{ headerShown: false }}>
      <AuthStack.Screen name="SignIn">
        {({ navigation }) => <SignInScreen onGoToSignUp={() => navigation.navigate("SignUp")} />}
      </AuthStack.Screen>
      <AuthStack.Screen name="SignUp">
        {({ navigation }) => <SignUpScreen onGoToSignIn={() => navigation.navigate("SignIn")} />}
      </AuthStack.Screen>
    </AuthStack.Navigator>
  );
}

function SplashScreen() {
  return (
    <View style={styles.splash}>
      <BrandLogo />
      <ActivityIndicator color={color.purple} />
    </View>
  );
}

export function RootNavigator() {
  const { session, initializing } = useAuth();
  // Keep the splash up for a beat even on a fast session read, so the app
  // doesn't flash three different screens in 200ms on a warm start.
  const [minimumSplashDone, setMinimumSplashDone] = useState(false);
  useEffect(() => {
    const timer = setTimeout(() => setMinimumSplashDone(true), 600);
    return () => clearTimeout(timer);
  }, []);

  if (initializing || !minimumSplashDone) return <SplashScreen />;

  return (
    <NavigationContainer>
      {session ? (
        <RootStack.Navigator screenOptions={{ headerShown: false }}>
          <RootStack.Screen name="Tabs" component={MainTabs} />
          <RootStack.Screen name="ShopDetail" component={ShopDetailScreen} />
          <RootStack.Screen
            name="Redeem"
            component={RedeemScreen}
            // The QR is time-boxed and single-use; a swipe-back mid-scan
            // would strand the shop staff mid-verification, so leaving is
            // an explicit action on the screen itself.
            options={{ gestureEnabled: false }}
          />
          <RootStack.Screen name="Notifications" component={NotificationsScreen} />
          <RootStack.Screen name="VerifyPhone" component={VerifyPhoneScreen} />
        </RootStack.Navigator>
      ) : (
        <AuthFlow />
      )}
    </NavigationContainer>
  );
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 32,
    backgroundColor: color.white,
  },
});
