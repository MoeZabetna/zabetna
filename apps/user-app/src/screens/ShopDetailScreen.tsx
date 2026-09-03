import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import type { NativeStackScreenProps } from "@react-navigation/native-stack";
import { PhotoPlaceholder } from "../components/PhotoPlaceholder";
import { supabase } from "../lib/supabase";
import { fetchOffersForShop, fetchShop, formatDiscount, type Offer, type Shop } from "../lib/catalog";
import type { RootStackParamList } from "../navigation/RootNavigator";
import { color, radius, space, type } from "../theme";

// Shop Detail — Figma node 58:1274. Shop header, then its live offers,
// each with the pink "Redeem Now" CTA that starts the redemption flow.

type Props = NativeStackScreenProps<RootStackParamList, "ShopDetail">;

export function ShopDetailScreen({ route, navigation }: Props) {
  const { shopId, shopName } = route.params;
  const [shop, setShop] = useState<Shop | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [shopRow, offerRows] = await Promise.all([
          fetchShop(supabase, shopId),
          fetchOffersForShop(supabase, shopId),
        ]);
        if (cancelled) return;
        setShop(shopRow);
        setOffers(offerRows);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Could not load this shop.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shopId]);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Pressable onPress={() => navigation.goBack()} hitSlop={10} accessibilityRole="button">
          <Ionicons name="chevron-back" size={24} color={color.primaryBlack} />
        </Pressable>
        <Text style={styles.headerTitle} numberOfLines={1}>
          {shop?.name ?? shopName}
        </Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {loading ? (
          <ActivityIndicator color={color.purple} style={styles.spinner} />
        ) : error ? (
          <Text style={styles.error}>{error}</Text>
        ) : !shop ? (
          <Text style={styles.error}>This shop is no longer available.</Text>
        ) : (
          <>
            <PhotoPlaceholder uri={shop.coverImages[0] ?? shop.logoUrl ?? undefined} style={styles.cover} radius={radius.md} />

            <View style={styles.metaBlock}>
              <Text style={styles.name}>{shop.name}</Text>
              {Boolean(shop.address || shop.city) && (
                <View style={styles.metaRow}>
                  <Ionicons name="location-outline" size={16} color={color.textMuted} />
                  <Text style={styles.metaText}>{[shop.address, shop.city].filter(Boolean).join(", ")}</Text>
                </View>
              )}
              {Boolean(shop.phone) && (
                <View style={styles.metaRow}>
                  <Ionicons name="call-outline" size={16} color={color.textMuted} />
                  <Text style={styles.metaText}>{shop.phone}</Text>
                </View>
              )}
              {Boolean(shop.description) && <Text style={styles.description}>{shop.description}</Text>}
            </View>

            <Text style={styles.sectionTitle}>Offers</Text>

            {offers.length === 0 ? (
              <Text style={styles.empty}>
                No offers running here right now. Offers can be scheduled for particular days, so check back.
              </Text>
            ) : (
              offers.map((offer) => (
                <View key={offer.id} style={styles.offerCard}>
                  <View style={styles.offerHead}>
                    <Text style={styles.discount}>{formatDiscount(offer)}</Text>
                    <Text style={styles.offerTitle}>{offer.title}</Text>
                  </View>

                  {Boolean(offer.description) && <Text style={styles.offerBody}>{offer.description}</Text>}

                  {offer.minimumOrderValue > 0 && (
                    <Text style={styles.minimum}>Minimum order ${offer.minimumOrderValue.toFixed(2)}</Text>
                  )}

                  {Boolean(offer.terms) && <Text style={styles.terms}>{offer.terms}</Text>}

                  <Pressable
                    style={styles.redeemCta}
                    onPress={() =>
                      navigation.navigate("Redeem", {
                        offerId: offer.id,
                        offerTitle: offer.title,
                        shopName: shop.name,
                      })
                    }
                  >
                    <Text style={styles.redeemLabel}>Redeem Now</Text>
                  </Pressable>
                </View>
              ))
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: color.white },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
  },
  headerTitle: { ...type.sectionTitle, color: color.primaryBlack, flex: 1 },
  content: { paddingHorizontal: space.lg, paddingBottom: 40, gap: space.md },
  spinner: { marginTop: space.xl },
  error: { ...type.cardTitle, color: color.danger, marginTop: space.md },
  cover: { width: "100%", height: 180 },
  metaBlock: { gap: space.xs },
  name: { ...type.sectionTitle, color: color.primaryBlack, textTransform: "none" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  metaText: { ...type.caption, color: color.textMuted, flex: 1 },
  description: { ...type.cardTitle, color: color.textMuted, marginTop: space.xs },
  sectionTitle: { ...type.sectionTitle, color: color.primaryBlack, marginTop: space.sm },
  empty: { ...type.cardTitle, color: color.textMuted },
  offerCard: {
    backgroundColor: color.white,
    borderRadius: radius.md,
    padding: space.md,
    gap: space.xs,
    shadowColor: color.cardShadowPink,
    shadowOpacity: 1,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  offerHead: { gap: 2 },
  discount: { ...type.cardTitleStrong, color: color.purple },
  offerTitle: { ...type.cardTitle, color: color.primaryBlack },
  offerBody: { ...type.caption, color: color.textMuted },
  minimum: { ...type.caption, color: color.black },
  terms: { ...type.disclosure, color: color.textMuted },
  redeemCta: {
    height: 40,
    borderRadius: radius.sm,
    backgroundColor: color.pink,
    alignItems: "center",
    justifyContent: "center",
    marginTop: space.xs,
  },
  redeemLabel: { ...type.cardButton, color: color.white, fontSize: 14 },
});
