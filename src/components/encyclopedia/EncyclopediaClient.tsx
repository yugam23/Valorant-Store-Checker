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

  // Precompute edition categories from tiers (sorted by hierarchy)
  const editionCategories = useMemo(() => {
    const EDITION_ORDER = ["Select Edition", "Deluxe Edition", "Premium Edition", "Exclusive Edition", "Ultra Edition"];
    return [...tiers].sort((a, b) => {
      const indexA = EDITION_ORDER.indexOf(a.displayName);
      const indexB = EDITION_ORDER.indexOf(b.displayName);
      if (indexA !== -1 && indexB !== -1) return indexA - indexB;
      if (indexA !== -1) return -1;
      if (indexB !== -1) return 1;
      return a.displayName.localeCompare(b.displayName);
    });
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
    <div className="min-h-screen bg-void p-6 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page Header */}
        <div className="space-y-4">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div className="space-y-2">
              <h1 className="font-display text-4xl md:text-5xl uppercase font-bold text-light tracking-wide">
                Encyclopedia
              </h1>
            </div>

            <div className="flex items-center gap-3">
              <div className="px-4 py-2 bg-valorant-red/20 border border-valorant-red angular-card-sm">
                <span className="text-valorant-red font-bold text-lg">
                  {skins.length} Skins
                </span>
              </div>
            </div>
          </div>
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
    </div>
  );
}
