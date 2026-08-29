import { ScrollView, StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { HeroBanner } from "../components/HeroBanner";
import { TopBar } from "../components/TopBar";
import { SectionHeader } from "../components/SectionHeader";
import { CategoryTile } from "../components/CategoryTile";
import { ShopCard } from "../components/ShopCard";
import { BottomNav } from "../components/BottomNav";
import { color, space } from "../theme";
import type { CategoryTileData, FeaturedGroup } from "../types/home";

// Sample data shaped exactly like the Figma content (get_design_context on
// node 40:3000) — category labels and featured-group names are copied
// verbatim from the design. Replace with real Supabase queries once
// `categories` / `featured_listings` / `shops` have rows:
//
//   supabase.from("categories").select("*").eq("is_active", true).order("sort_order")
//   supabase.from("featured_listings").select("*, shops(*)").eq("category_id", id).order("rank")
const CATEGORIES: CategoryTileData[] = [
  { id: "club-pubs", label: "Club & Pubs", icon: "wine-outline" },
  { id: "fashion", label: "Fashion", icon: "shirt-outline" },
  { id: "restaurants", label: "Restaurants", icon: "restaurant-outline" },
  { id: "activities", label: "Activities", icon: "football-outline" },
  { id: "cars", label: "Cars", icon: "car-outline" },
  { id: "pets", label: "Pets", icon: "paw-outline" },
  { id: "gym", label: "Gym", icon: "barbell-outline" },
  { id: "electronic", label: "Electronic", icon: "tv-outline" },
  { id: "view-all", label: "View All", icon: "apps-outline" },
];

const FEATURED: FeaturedGroup[] = [
  {
    categoryLabel: "Featured Restaurants",
    shops: [
      { id: "r1", name: "Restaurant 1" },
      { id: "r2", name: "Restaurant 2" },
      { id: "r3", name: "Restaurant 3" },
    ],
  },
  {
    categoryLabel: "Featured Clubs & Pubs",
    shops: [
      { id: "c1", name: "Club 1" },
      { id: "c2", name: "Pub 2" },
      { id: "c3", name: "Club & Pub 3" },
    ],
  },
  {
    categoryLabel: "Featured Pet Care",
    shops: [
      { id: "p1", name: "Pet Care 1" },
      { id: "p2", name: "Pet Care 2" },
      { id: "p3", name: "Pet Care 3" },
    ],
  },
];

export function HomeScreen() {
  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <TopBar city="Dubai" area="D3 Park" />
        <HeroBanner />

        <View style={styles.section}>
          <SectionHeader title="Categories" />
          <View style={styles.categoryGrid}>
            {CATEGORIES.map((cat) => (
              <CategoryTile key={cat.id} category={cat} />
            ))}
          </View>
        </View>

        {FEATURED.map((group) => (
          <View style={styles.section} key={group.categoryLabel}>
            <SectionHeader title={group.categoryLabel} />
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
              {group.shops.map((shop) => (
                <ShopCard key={shop.id} shop={shop} />
              ))}
            </ScrollView>
          </View>
        ))}
      </ScrollView>

      <View style={styles.navWrap} pointerEvents="box-none">
        <BottomNav active="home" />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.white },
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 110, gap: space.xl },
  section: { gap: space.sm },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, justifyContent: "space-between" },
  row: { gap: space.xs },
  navWrap: { position: "absolute", left: 0, right: 0, bottom: 25 },
});
