import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useFonts, Poppins_400Regular, Poppins_500Medium } from "@expo-google-fonts/poppins";
import { HomeScreen } from "./src/screens/HomeScreen";
import { color } from "./src/theme";

// React Navigation isn't wired up yet — HomeScreen is the only Main Screen
// built so far (see docs/blueprint.html §06, Phase 02). Swap this for a
// navigator's initial route once Categories/Shop Detail/etc. exist.
export default function App() {
  const [fontsLoaded] = useFonts({ Poppins_400Regular, Poppins_500Medium });

  if (!fontsLoaded) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color={color.purple} />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <HomeScreen />
      <StatusBar style="dark" />
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: color.white },
});
