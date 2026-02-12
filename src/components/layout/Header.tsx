import Link from "next/link";
import { Button } from "../ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-40 w-full bg-void-deep/90 backdrop-blur-md" style={{ clipPath: "polygon(0 0, 100% 0, 100% calc(100% - 6px), 50% 100%, 0 calc(100% - 6px))" }}>
      {/* Red accent line at top */}
      <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-valorant-red to-transparent" />

      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="group flex items-center gap-2">
          <span className="text-2xl font-display font-bold tracking-wider text-white uppercase transition-all duration-300 group-hover:drop-shadow-[0_0_12px_rgba(255,70,85,0.8)]">
            VALORANT STORE
          </span>
        </Link>

        <nav className="flex items-center gap-6">
          <Link href="/" className="group relative py-1 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Home
            <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-valorant-red transition-all duration-300 group-hover:w-full" />
          </Link>
          <Link href="/store" className="group relative py-1 text-sm font-medium text-zinc-400 hover:text-white transition-colors">
            Store
            <span className="absolute bottom-0 left-0 h-[2px] w-0 bg-valorant-red transition-all duration-300 group-hover:w-full" />
          </Link>
          <Button variant="valorant" size="sm" asChild>
            <Link href="/login">Login with Riot</Link>
          </Button>
        </nav>
      </div>
    </header>
  );
}
