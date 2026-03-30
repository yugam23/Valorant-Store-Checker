"use client";

import { useState, useMemo, useEffect } from "react";
import type { EncyclopediaClientProps, EncyclopediaSkin } from "@/types/encyclopedia";
import type { WishlistItem } from "@/types/wishlist";
import { EncyclopediaGrid } from "./EncyclopediaGrid";

export function EncyclopediaClient({ skins, tiers, tierMap }: EncyclopediaClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeWeapons, setActiveWeapons] = useState<string[]>([]);
  const [activeEditions, setActiveEditions] = useState<string[]>([]);

  // Wishlist state
  const [wishlistSet, setWishlistSet] = useState<Set<string>>(new Set());
  const [loadingWishlist, setLoadingWishlist] = useState(true);

  // Precompute weapon categories (sorted unique weapon names from skins)
  const weaponCategories = useMemo(() => {
    const set = new Set<string>();
    for (const skin of skins) {
      set.add(skin.weaponName);
    }
    return Array.from(set).sort();
  }, [skins]);

  // Precompute edition categories from tiers (sorted alphabetically)
  const editionCategories = useMemo(() => {
    return [...tiers].sort((a, b) => a.displayName.localeCompare(b.displayName));
  }, [tiers]);

  // Fetch wishlist on mount
  useEffect(() => {
    async function fetchWishlist() {
      try {
        const res = await fetch("/api/wishlist", { credentials: "include" });
        if (res.ok) {
          const data = await res.json();
          setWishlistSet(new Set(data.items.map((i: WishlistItem) => i.skinUuid)));
        }
      } catch {
        // Silently ignore network errors
      } finally {
        setLoadingWishlist(false);
      }
    }
    fetchWishlist();
  }, []);

  const toggleWishlist = async (skinUuid: string, skin: EncyclopediaSkin) => {
    const isCurrentlyWishlisted = wishlistSet.has(skinUuid);
    const method = isCurrentlyWishlisted ? "DELETE" : "POST";
    const body = isCurrentlyWishlisted
      ? { skinUuid }
      : { skinUuid, displayName: skin.displayName, displayIcon: skin.displayIcon, tierColor: skin.tierColor };

    // Optimistic update
    setWishlistSet((prev) => {
      const next = new Set(prev);
      if (isCurrentlyWishlisted) {
        next.delete(skinUuid);
      } else {
        next.add(skinUuid);
      }
      return next;
    });

    try {
      const res = await fetch("/api/wishlist", {
        method,
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        // Revert optimistic update on failure
        setWishlistSet((prev) => {
          const next = new Set(prev);
          if (isCurrentlyWishlisted) {
            next.add(skinUuid);
          } else {
            next.delete(skinUuid);
          }
          return next;
        });
      }
    } catch {
      // Revert on network error
      setWishlistSet((prev) => {
        const next = new Set(prev);
        if (isCurrentlyWishlisted) {
          next.add(skinUuid);
        } else {
          next.delete(skinUuid);
        }
        return next;
      });
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-8">
        <h1 className="font-display text-3xl uppercase font-bold text-light tracking-wide">
          Encyclopedia
        </h1>
        <p className="text-zinc-400 mt-1 text-sm">
          Browse all Valorant weapon skins
        </p>
      </div>

      <EncyclopediaGrid
        skins={skins}
        weaponCategories={weaponCategories}
        editionCategories={editionCategories}
        tierMap={tierMap}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        activeWeapons={activeWeapons}
        setActiveWeapons={setActiveWeapons}
        activeEditions={activeEditions}
        setActiveEditions={setActiveEditions}
        wishlistSet={wishlistSet}
        loadingWishlist={loadingWishlist}
        toggleWishlist={toggleWishlist}
      />
    </div>
  );
}
