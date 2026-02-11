import Link from "next/link";
import { Button } from "../ui/button";

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-white/10 bg-void/80 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <span className="text-xl font-bold tracking-tight text-white hover:text-valorant-red transition-colors">
            VALORANT STORE
          </span>
        </Link>
        <nav className="flex items-center gap-6">
          <Link
            href="/"
            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
          >
            Home
          </Link>
          <Link
            href="/store"
            className="text-sm font-medium text-muted-foreground hover:text-white transition-colors"
          >
            Store
          </Link>
          <Button variant="valorant" size="sm">
            Login with Riot
          </Button>
        </nav>
      </div>
    </header>
  );
}
