import type { Metadata } from "next";
import { Inter } from "next/font/google"; // Use Inter
import "./globals.css";
import { Header } from "@/components/layout/Header";

const inter = Inter({ subsets: ["latin"] });

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
      <body className={`${inter.className} min-h-screen flex flex-col antialiased bg-void text-light`}>
        <Header />
        <main className="flex-1">
            {children}
        </main>
      </body>
    </html>
  );
}
