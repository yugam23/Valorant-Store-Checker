"use client";

import { useState, useEffect } from "react";
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import type { WishlistItem } from "@/types/wishlist";
import type { OwnedSkin } from "@/types/inventory";

function WishlistGridSkeleton() {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="angular-card bg-void-surface overflow-hidden animate-pulse"
        >
          <div className="aspect-[16/9] bg-void-deep/50" />
          <div className="p-4 space-y-3">
            <div className="h-4 bg-void-deep/50 rounded w-3/4" />
            <div className="h-[1px] bg-white/10 w-full" />
            <div className="h-3 bg-void-deep/50 rounded w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

const WishlistGrid = dynamic(
  () => import("@/components/wishlist/WishlistGrid").then(m => m.WishlistGrid),
  {
    ssr: false,
    loading: () => <WishlistGridSkeleton />,
  }
);

export default function WishlistPage() {
  const [wishlistItems, setWishlistItems] = useState<WishlistItem[]>([]);
  const [ownedSet, setOwnedSet] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setError(null);

      // Fetch wishlist
      try {
        const wishlistRes = await fetch("/api/wishlist", {
          credentials: "include",
        });

        if (wishlistRes.status === 401) {
          if (!cancelled) redirect("/login");
          return;
        }

        if (!wishlistRes.ok) {
          throw new Error(`Wishlist fetch failed: ${wishlistRes.status}`);
        }

        const wishlistData = await wishlistRes.json();
        if (!cancelled) {
          setWishlistItems(wishlistData.items ?? []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load wishlist");
        }
        return;
      }

      // Fetch inventory (optional — silently handle errors)
      try {
        const inventoryRes = await fetch("/api/inventory?refresh=false", {
          credentials: "include",
        });

        if (inventoryRes.ok) {
          const inventoryData = await inventoryRes.json();
          if (!cancelled) {
            setOwnedSet(new Set(inventoryData.skins.map((s: OwnedSkin) => s.uuid)));
          }
        }
      } catch {
        // Inventory is optional — ignore errors
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleRemove(skinUuid: string) {
    // Optimistic update
    setWishlistItems((prev) => prev.filter((i) => i.skinUuid !== skinUuid));

    try {
      const res = await fetch("/api/wishlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ skinUuid }),
      });

      if (!res.ok) {
        // Revert optimistic update on failure
        const wishlistRes = await fetch("/api/wishlist", {
          credentials: "include",
        });
        if (wishlistRes.ok) {
          const wishlistData = await wishlistRes.json();
          setWishlistItems(wishlistData.items ?? []);
        }
      }
    } catch {
      // Revert on network error
      const wishlistRes = await fetch("/api/wishlist", {
        credentials: "include",
      });
      if (wishlistRes.ok) {
        const wishlistData = await wishlistRes.json();
        setWishlistItems(wishlistData.items ?? []);
      }
    }
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl uppercase font-bold text-light tracking-wide">
            Wishlist
          </h1>
          <p className="text-zinc-400 mt-1 text-sm">
            {wishlistItems.length} {wishlistItems.length === 1 ? "skin" : "skins"}
          </p>
        </div>
      </div>

      {error && (
        <div className="angular-card bg-void-surface/50 border-red-500/20 p-6 text-center space-y-4">
          <p className="text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 bg-valorant-red text-white text-sm font-bold uppercase angular-card-sm hover:bg-valorant-red/80 transition-colors"
          >
            Retry
          </button>
        </div>
      )}

      {!error && (
        <WishlistGrid
          items={wishlistItems}
          ownedSet={ownedSet}
          onRemove={handleRemove}
        />
      )}
    </div>
  );
}
