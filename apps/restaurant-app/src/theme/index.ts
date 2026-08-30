// This app has no Figma design behind it (Mo: "it doesn't need figma, it's a
// straight on app") — a small, consistent set of tokens instead of a design
// file. The purple accent matches the User App's brand color (see
// apps/user-app/src/theme/index.ts) so the two apps read as one product;
// everything else is a plain, utilitarian palette sized for a fast,
// legible work tool rather than a marketing surface.

export const color = {
  purple: "#913FE6",
  purpleDark: "#6E2CB5",
  purpleFaint: "#F3EAFD",

  success: "#1E9E5A",
  successFaint: "#E6F7EE",
  danger: "#D6423C",
  dangerFaint: "#FCEAE9",

  ink: "#1C1B1F",
  inkMuted: "#5B5865",
  inkFaint: "#8B889450",
  border: "#E4E1EA",
  surface: "#FFFFFF",
  background: "#F7F5FA",
} as const;

export const space = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
} as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 20,
} as const;

export const type = {
  title: { fontSize: 22, fontWeight: "700" as const },
  heading: { fontSize: 17, fontWeight: "600" as const },
  body: { fontSize: 15, fontWeight: "400" as const },
  label: { fontSize: 13, fontWeight: "600" as const },
  caption: { fontSize: 12, fontWeight: "400" as const },
};
