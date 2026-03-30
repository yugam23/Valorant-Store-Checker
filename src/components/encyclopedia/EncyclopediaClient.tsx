"use client";

import { useState, useMemo } from "react";
import type { EncyclopediaClientProps } from "@/types/encyclopedia";
import { EncyclopediaGrid } from "./EncyclopediaGrid";

export function EncyclopediaClient({ skins, tiers, tierMap }: EncyclopediaClientProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeWeapons, setActiveWeapons] = useState<string[]>([]);
  const [activeEditions, setActiveEditions] = useState<string[]>([]);

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
      />
    </div>
  );
}
