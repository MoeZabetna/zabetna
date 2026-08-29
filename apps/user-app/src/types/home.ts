import type { ComponentProps } from "react";
import type { Ionicons } from "@expo/vector-icons";

// Local view-model types for the Home Screen. These are intentionally
// separate from the generated `Database["public"]["Tables"]["shops"]["Row"]`
// shape — the screen only needs a thin slice of a shop/category, and mapping
// from a Supabase query result into this shape happens in one place
// (screens/HomeScreen.tsx) once real data replaces the sample data below.

export type IoniconName = ComponentProps<typeof Ionicons>["name"];

export interface CategoryTileData {
  id: string;
  label: string;
  icon: IoniconName;
}

export interface ShopCardData {
  id: string;
  name: string;
  imageUrl?: string;
}

export interface FeaturedGroup {
  categoryLabel: string; // e.g. "Featured Restaurants" — mirrors featured_listings grouped by category
  shops: ShopCardData[]; // top 3, per docs/blueprint.html §03 (featured_listings.rank)
}
