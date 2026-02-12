import type { Metadata } from "next";
import { Teko, Outfit } from "next/font/google";
import "./globals.css";
import { Header } from "@/components/layout/Header";

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

        <Header />
        <main className="relative z-10 flex-1">{children}</main>
      </body>
    </html>
  );
}
