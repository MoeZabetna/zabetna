import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { HeroBanner } from "../components/HeroBanner";
import { TopBar } from "../components/TopBar";
import { SectionHeader } from "../components/SectionHeader";
import { CategoryTile } from "../components/CategoryTile";
import { ShopCard } from "../components/ShopCard";
import { supabase } from "../lib/supabase";
import { fetchCategories, fetchShopsByCategories, type Category, type Shop } from "../lib/catalog";
import { categoryIcon } from "../lib/categoryIcons";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { color, space, type } from "../theme";

// Home Screen — Figma node 40:3000.
//
// The layout is unchanged from the version built on 2026-08-29; what
// changed on 2026-09-02 is that the categories and featured shops are now
// real Supabase rows instead of the sample arrays copied from the design.
// The sample data is gone rather than kept as a fallback: a screen that
// silently shows fake shops when a query fails is worse than one that says
// it couldn't load.

type Nav = NativeStackNavigationProp<RootStackParamList>;

type FeaturedGroup = { category: Category; shops: Shop[] };

export function HomeScreen() {
  const navigation = useNavigation<Nav>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [featured, setFeatured] = useState<FeaturedGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      const cats = await fetchCategories(supabase);
      setCategories(cats);

      // Three featured rows, matching the design. Categories with no live
      // shops are skipped rather than rendered as an empty row.
      const topCategories = cats.slice(0, 3);
      const grouped = await fetchShopsByCategories(
        supabase,
        topCategories.map((c) => c.id)
      );
      setFeatured(
        topCategories
          .map((category) => ({ category, shops: grouped.get(category.id) ?? [] }))
          .filter((group) => group.shops.length > 0)
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load shops.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    void load();
  }, [load]);

  const openShop = useCallback(
    (shop: Shop) => navigation.navigate("ShopDetail", { shopId: shop.id, shopName: shop.name }),
    [navigation]
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={color.purple} />}
      >
        <TopBar city="Beirut" area="Lebanon" />
        <HeroBanner />

        {loading ? (
          <View style={styles.centered}>
            <ActivityIndicator color={color.purple} />
          </View>
        ) : error ? (
          <View style={styles.centered}>
            <Text style={styles.error}>{error}</Text>
            <Text style={styles.errorHint}>Pull down to try again.</Text>
          </View>
        ) : (
          <>
            <View style={styles.section}>
              <SectionHeader title="Categories" />
              <View style={styles.categoryGrid}>
                {categories.map((cat) => (
                  <CategoryTile
                    key={cat.id}
                    category={{ id: cat.id, label: cat.name, icon: categoryIcon(cat.name) }}
                    onPress={() => navigation.navigate("Tabs", { screen: "Categories" })}
                  />
                ))}
              </View>
            </View>

            {featured.map((group) => (
              <View style={styles.section} key={group.category.id}>
                <SectionHeader title={`Featured ${group.category.name}`} />
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
                  {group.shops.map((shop) => (
                    <ShopCard
                      key={shop.id}
                      shop={{ id: shop.id, name: shop.name, imageUrl: shop.coverImages[0] ?? shop.logoUrl ?? undefined }}
                      onPress={() => openShop(shop)}
                    />
                  ))}
                </ScrollView>
              </View>
            ))}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.white },
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 110, gap: space.xl },
  section: { gap: space.sm },
  categoryGrid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, justifyContent: "space-between" },
  row: { gap: space.xs },
  centered: { paddingVertical: space.xl, alignItems: "center", gap: space.xs },
  error: { ...type.cardTitle, color: color.danger, textAlign: "center" },
  errorHint: { ...type.caption, color: color.textMuted },
});
