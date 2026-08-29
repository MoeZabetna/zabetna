import type { Metadata } from "next";
import "./globals.css";

// The scaffold's default (next/font/google Geist/Geist Mono) requires
// fetching fonts.googleapis.com at build time — unreachable from this
// sandbox, and not something a production build should depend on being
// reachable either. System font stack instead; swap in next/font/local
// for a real brand typeface once one is chosen.
export const metadata: Metadata = {
  title: "Zabetna Admin",
  description: "Operations panel for shops, categories, and reporting.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
