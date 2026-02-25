import type { Metadata } from "next";
import { Teko, Outfit } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";

// Every page in this app reads session cookies, so static pre-rendering
// at build time always fails. This single export opts the entire app out.
export const dynamic = "force-dynamic";

const teko = Teko({
  subsets: ["latin"],
  variable: "--font-teko",
  weight: ["400", "500", "600", "700"],
});

const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
});

export const metadata: Metadata = {
  title: "Valorant Store Checker",
  description: "Check your daily Valorant store offers.",
  icons: {
    icon: "/icons/vsc-logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${teko.variable} ${outfit.variable} font-sans min-h-screen flex flex-col antialiased bg-void text-light`}
      >
        {/* Noise texture overlay */}
        <div className="noise-overlay" />

        {/* Skip-to-content link for keyboard/screen reader users */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:bg-valorant-red focus:text-white focus:font-display focus:uppercase focus:tracking-wider focus:angular-card-sm"
        >
          Skip to content
        </a>

        <Header />
        <main id="main-content" className="relative z-10 flex-1">{children}</main>
      </body>
    </html>
  );
}
