import type { IoniconName } from "../types/home";

/**
 * Maps a category to an Ionicon.
 *
 * `categories.icon` is free text set from the admin panel, and the seeded
 * values came from the Figma design's icon set (hugeicons/solar/iconoir
 * names), none of which exist in Ionicons. Rather than fail on an unknown
 * string, this matches on the category *name* — which is stable, seeded,
 * and what a user actually sees — and falls back to a generic tag icon so
 * a category added tomorrow still renders something sensible.
 *
 * Same reasoning as CategoryTile.tsx's comment: one tintable icon font
 * beats a folder of per-family SVGs.
 */
const BY_NAME: Record<string, IoniconName> = {
  "club & pubs": "wine-outline",
  "clubs & pubs": "wine-outline",
  fashion: "shirt-outline",
  restaurants: "restaurant-outline",
  activities: "football-outline",
  cars: "car-outline",
  pets: "paw-outline",
  gym: "barbell-outline",
  electronic: "tv-outline",
  electronics: "tv-outline",
};

export function categoryIcon(categoryName: string): IoniconName {
  return BY_NAME[categoryName.trim().toLowerCase()] ?? "pricetag-outline";
}
