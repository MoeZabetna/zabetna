import { View, StyleSheet } from "react-native";
import { createBottomTabNavigator, type BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { BottomNav, type NavKey } from "../components/BottomNav";
import { HomeScreen } from "../screens/HomeScreen";
import { CategoriesScreen } from "../screens/CategoriesScreen";
import { RewardsScreen } from "../screens/RewardsScreen";
import { ProfileScreen } from "../screens/ProfileScreen";

export type TabParamList = {
  Home: undefined;
  Categories: undefined;
  Rewards: undefined;
  Profile: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

// Route names and the design's nav keys are 1:1 but not identically cased,
// so the mapping is explicit rather than a toLowerCase() that would break
// silently the first time a route is renamed.
const ROUTE_TO_KEY: Record<keyof TabParamList, NavKey> = {
  Home: "home",
  Categories: "categories",
  Rewards: "rewards",
  Profile: "profile",
};

const KEY_TO_ROUTE: Record<NavKey, keyof TabParamList> = {
  home: "Home",
  categories: "Categories",
  rewards: "Rewards",
  profile: "Profile",
};

/**
 * The designed nav is a floating purple pill (Figma component 56:357), not
 * a standard tab bar, so it's supplied as a custom `tabBar` and the real
 * one is hidden. Screens keep their own bottom padding for it — the pill
 * floats over content by design.
 */
function FloatingTabBar({ state, navigation }: BottomTabBarProps) {
  const routeName = state.routes[state.index].name as keyof TabParamList;
  return (
    <View style={styles.wrap} pointerEvents="box-none">
      <BottomNav
        active={ROUTE_TO_KEY[routeName]}
        onSelect={(key) => navigation.navigate(KEY_TO_ROUTE[key])}
      />
    </View>
  );
}

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={{ headerShown: false, sceneStyle: { backgroundColor: "transparent" } }}
      tabBar={(props) => <FloatingTabBar {...props} />}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Categories" component={CategoriesScreen} />
      <Tab.Screen name="Rewards" component={RewardsScreen} />
      <Tab.Screen name="Profile" component={ProfileScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  wrap: { position: "absolute", left: 0, right: 0, bottom: 25 },
});
