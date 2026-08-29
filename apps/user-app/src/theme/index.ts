// Design tokens pulled from the Zabetna Figma file (get_variable_defs on the
// Home Screen node) plus values read directly off the frame in
// get_design_context. Every screen should style from these tokens, not
// inline hex values, so a future palette/type change is a one-file edit.

export const color = {
  // From Figma variables
  black: "#212121", // body text
  primaryBlack: "#2B2B2B", // headings / high-emphasis text
  pink: "#F281BC", // primary CTA (e.g. "View Details")
  skyblue: "#6CCAFB", // active bottom-nav tile
  purple: "#913FE6", // bottom nav bar, promo accents

  // Read directly off frame fills/strokes — not exposed as named variables
  // in the file, but reused consistently across the Home Screen.
  white: "#FFFFFF",
  locationBlue: "#080BC9", // "Dubai," in the location pill
  searchBg: "rgba(116,245,250,0.2)",
  cardShadow: "rgba(0,0,0,0.1)",
  cardShadowPink: "rgba(242,129,188,0.15)",
  textMuted: "rgba(30,30,30,0.6)",
  textFaint: "rgba(0,0,0,0.8)",
  placeholderBg: "#ECE6F5", // stand-in for un-set shop/offer photos
  placeholderIcon: "#B9A6DE",
} as const;

export const font = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
} as const;

export const type = {
  sectionTitle: { fontFamily: font.medium, fontSize: 18, lineHeight: 30, textTransform: "uppercase" as const },
  cardTitle: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  cardButton: { fontFamily: font.medium, fontSize: 12, lineHeight: 20 },
  categoryLabel: { fontFamily: font.medium, fontSize: 12, lineHeight: 24 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 20 },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16 },
};

export const space = {
  xs: 4,
  sm: 8,
  md: 14,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 24,
} as const;
