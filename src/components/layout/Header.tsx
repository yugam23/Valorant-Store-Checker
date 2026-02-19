import Link from "next/link";
import Image from "next/image";
import { Button } from "../ui/button";
import { hasValidSession } from "@/lib/session";
import { AccountSwitcher } from "./AccountSwitcher";
import { WishlistButton } from "./WishlistButton";

export async function Header() {
  const isLoggedIn = await hasValidSession();

  return (
    <header className="sticky top-0 z-40 w-full">
      {/* Background layer with clip-path for angular cut */}
      <div className="absolute inset-0 bg-void-deep/90 backdrop-blur-md" style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 6px), 50% 100%, 0 calc(100% - 6px))" }} />

      {/* Red accent line at top */}
      <div className="relative h-[1px] w-full bg-gradient-to-r from-transparent via-valorant-red to-transparent" />

      <div className="relative container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2">
    <div className="relative h-12 w-auto">
            <Image
              src="/icons/Valorant_Store_Checker.webp"
              alt="Valorant Store Checker"
              width={0}
              height={0}
              sizes="100vw"
              className="h-full w-auto object-contain transition-all duration-300 group-hover:drop-shadow-[0_0_12px_rgba(255,70,85,0.8)]"
            />
          </div>
        </Link>

        <nav className="flex items-center gap-6" aria-label="Main navigation">
          <Link href="/" className="group relative py-1 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Home
            <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-valorant-red transition-all duration-300 group-hover:w-full" />
          </Link>
          <Link href="/store" className="group relative py-1 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Store
            <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-valorant-red transition-all duration-300 group-hover:w-full" />
          </Link>
          <Link href="/inventory" className="group relative py-1 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Collection
            <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-valorant-red transition-all duration-300 group-hover:w-full" />
          </Link>
          <Link href="/history" className="group relative py-1 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            History
            <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-valorant-red transition-all duration-300 group-hover:w-full" />
          </Link>
          <Link href="/profile" className="group relative py-1 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Profile
            <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-valorant-red transition-all duration-300 group-hover:w-full" />
          </Link>
          {isLoggedIn ? (
            <>
              <WishlistButton />
              <AccountSwitcher />
            </>
          ) : (
            <Button variant="valorant" size="sm" asChild>
              <Link href="/login">Login with Riot</Link>
            </Button>
          )}
        </nav>
      </div>
    </header>
  );
}
