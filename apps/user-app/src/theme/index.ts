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

  // Rewards Screen. The pink->purple pair is the same gradient the Figma
  // Profile Screen header uses (read off that frame on 2026-08-30); it is
  // reused rather than re-picked so the two headers stay identical.
  danger: "#C0392B", // rejected-request / blocking-error text
  successBg: "#E8F7F0", // submitted-confirmation card
  success: "#2F7A63",
  divider: "rgba(0,0,0,0.08)",
  disabled: "#C9C4D1", // CTA when the server would reject the request

  // Auth screens (Sign in 36:956, Sign Up 36:994). The pill inputs and the
  // 56px pill CTA are their own system, distinct from the Home Screen's
  // rounded-12 cards.
  inputBorder: "#D0D5DD",
  inputLabel: "#263238",
  inputPlaceholder: "rgba(102,112,133,0.8)",
  linkBlue: "#2A1AF6", // "Forgot password"
} as const;

// Gradient stops for the balance hero. expo-linear-gradient takes an array,
// so this is a tuple rather than two named tokens.
export const gradient = {
  balanceHero: ["#F281BC", "#913FE6"] as const,
};

export const font = {
  regular: "Poppins_400Regular",
  medium: "Poppins_500Medium",
  semibold: "Poppins_600SemiBold",
  bold: "Poppins_700Bold",
} as const;

export const type = {
  sectionTitle: { fontFamily: font.medium, fontSize: 18, lineHeight: 30, textTransform: "uppercase" as const },
  cardTitle: { fontFamily: font.regular, fontSize: 14, lineHeight: 20 },
  cardButton: { fontFamily: font.medium, fontSize: 12, lineHeight: 20 },
  categoryLabel: { fontFamily: font.medium, fontSize: 12, lineHeight: 24 },
  body: { fontFamily: font.regular, fontSize: 16, lineHeight: 20 },
  caption: { fontFamily: font.regular, fontSize: 12, lineHeight: 16 },

  // Rewards Screen
  heroLabel: { fontFamily: font.medium, fontSize: 12, lineHeight: 18, letterSpacing: 1.2, textTransform: "uppercase" as const },
  heroBalance: { fontFamily: font.bold, fontSize: 48, lineHeight: 58 },
  heroUsd: { fontFamily: font.medium, fontSize: 18, lineHeight: 26 },
  cardTitleStrong: { fontFamily: font.semibold, fontSize: 16, lineHeight: 24 },
  ctaLabel: { fontFamily: font.semibold, fontSize: 16, lineHeight: 24 },
  disclosure: { fontFamily: font.regular, fontSize: 12, lineHeight: 18 },

  // Auth screens
  inputLabel: { fontFamily: font.semibold, fontSize: 12, lineHeight: 18 },
  inputText: { fontFamily: font.regular, fontSize: 12, lineHeight: 24 },
  authCta: { fontFamily: font.medium, fontSize: 16, lineHeight: 30 },
  authFootnote: { fontFamily: font.regular, fontSize: 14, lineHeight: 18 },
  authFootnoteLink: { fontFamily: font.bold, fontSize: 14, lineHeight: 24 },
  smallLink: { fontFamily: font.semibold, fontSize: 12, lineHeight: 18 },
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
  pill: 45, // auth inputs and the auth CTA button
} as const;

/**
 * The auth screens are laid out as a fixed 327px column at x=24 on a 375px
 * frame — i.e. 24px side margins, the same gutter the Home Screen uses.
 */
export const layout = {
  gutter: 24,
  contentWidth: 327,
  ctaHeight: 56,
  logo: { width: 154, height: 180 },
} as const;
