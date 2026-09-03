import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import type { NativeStackNavigationProp } from "@react-navigation/native-stack";
import { CategoryTile } from "../components/CategoryTile";
import { PhotoPlaceholder } from "../components/PhotoPlaceholder";
import { SectionHeader } from "../components/SectionHeader";
import { supabase } from "../lib/supabase";
import { fetchCategories, fetchShops, type Category, type Shop } from "../lib/catalog";
import { categoryIcon } from "../lib/categoryIcons";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { color, radius, space, type } from "../theme";

// Categories Screen — Figma node 199:1090.
//
// Selecting a category swaps this screen to that category's shop list
// rather than pushing a route: the design has no separate "shops in
// category" frame (Shops Screen, 152:3026, is the all-shops list), and a
// back arrow inside the screen matches how the design's other drill-downs
// behave.
type Nav = NativeStackNavigationProp<RootStackParamList>;

export function CategoriesScreen() {
  const navigation = useNavigation<Nav>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [selected, setSelected] = useState<Category | null>(null);
  const [shops, setShops] = useState<Shop[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingShops, setLoadingShops] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchCategories(supabase)
      .then((rows) => {
        if (!cancelled) setCategories(rows);
      })
      .catch((err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load categories.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openCategory = useCallback(async (category: Category) => {
    setSelected(category);
    setLoadingShops(true);
    setError(null);
    try {
      setShops(await fetchShops(supabase, { categoryId: category.id }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load shops.");
    } finally {
      setLoadingShops(false);
    }
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {selected ? (
          <>
            <View style={styles.headerRow}>
              <Pressable onPress={() => setSelected(null)} hitSlop={10} accessibilityRole="button">
                <Ionicons name="chevron-back" size={24} color={color.primaryBlack} />
              </Pressable>
              <SectionHeader title={selected.name} />
            </View>

            {loadingShops ? (
              <ActivityIndicator color={color.purple} style={styles.spinner} />
            ) : shops.length === 0 ? (
              <Text style={styles.empty}>No shops in {selected.name} yet.</Text>
            ) : (
              <View style={styles.shopList}>
                {shops.map((shop) => (
                  <Pressable
                    key={shop.id}
                    style={styles.shopRow}
                    onPress={() => navigation.navigate("ShopDetail", { shopId: shop.id, shopName: shop.name })}
                  >
                    <PhotoPlaceholder
                      uri={shop.coverImages[0] ?? shop.logoUrl ?? undefined}
                      style={styles.shopPhoto}
                      radius={radius.sm}
                    />
                    <View style={styles.shopMeta}>
                      <Text style={styles.shopName} numberOfLines={1}>
                        {shop.name}
                      </Text>
                      <Text style={styles.shopAddress} numberOfLines={1}>
                        {shop.address ?? shop.city ?? "Beirut"}
                      </Text>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={color.textMuted} />
                  </Pressable>
                ))}
              </View>
            )}
          </>
        ) : (
          <>
            <SectionHeader title="Categories" />
            {loading ? (
              <ActivityIndicator color={color.purple} style={styles.spinner} />
            ) : error ? (
              <Text style={styles.error}>{error}</Text>
            ) : (
              <View style={styles.grid}>
                {categories.map((cat) => (
                  <CategoryTile
                    key={cat.id}
                    category={{ id: cat.id, label: cat.name, icon: categoryIcon(cat.name) }}
                    onPress={() => void openCategory(cat)}
                  />
                ))}
              </View>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.white },
  content: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: 110, gap: space.md },
  headerRow: { flexDirection: "row", alignItems: "center", gap: space.sm },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: space.md, justifyContent: "space-between" },
  spinner: { marginTop: space.xl },
  empty: { ...type.cardTitle, color: color.textMuted, marginTop: space.md },
  error: { ...type.cardTitle, color: color.danger, marginTop: space.md },
  shopList: { gap: space.sm },
  shopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.md,
    backgroundColor: color.white,
    borderRadius: radius.md,
    padding: space.sm,
    shadowColor: color.cardShadow,
    shadowOpacity: 1,
    shadowRadius: 7.5,
    shadowOffset: { width: 0, height: 0 },
    elevation: 1,
  },
  shopPhoto: { width: 64, height: 64 },
  shopMeta: { flex: 1, gap: 2 },
  shopName: { ...type.cardTitleStrong, color: color.primaryBlack },
  shopAddress: { ...type.caption, color: color.textMuted },
});
