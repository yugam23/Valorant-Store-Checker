"use client";

import { useMemo } from "react";
import type { EncyclopediaSkin, EncyclopediaTier } from "@/types/encyclopedia";
import { EncyclopediaCard } from "./EncyclopediaCard";

interface EncyclopediaGridProps {
  skins: EncyclopediaSkin[];
  weaponCategories: string[];
  editionCategories: EncyclopediaTier[];
  tierMap: Map<string, EncyclopediaTier>;
  searchQuery: string;
  setSearchQuery: (q: string) => void;
  activeWeapons: string[];
  setActiveWeapons: (w: string[]) => void;
  activeEditions: string[];
  setActiveEditions: (e: string[]) => void;
}

export function EncyclopediaGrid({
  skins,
  tierMap: _tierMap,
  weaponCategories,
  editionCategories,
  searchQuery,
  setSearchQuery,
  activeWeapons,
  setActiveWeapons,
  activeEditions,
  setActiveEditions,
}: EncyclopediaGridProps) {
  // Composable filtering: weapon → edition → search
  const filteredSkins = useMemo(() => {
    let result = skins;

    if (activeWeapons.length > 0) {
      result = result.filter((skin) => activeWeapons.includes(skin.weaponName));
    }

    if (activeEditions.length > 0) {
      result = result.filter((skin) => activeEditions.includes(skin.tierName));
    }

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((skin) =>
        skin.displayName.toLowerCase().includes(query)
      );
    }

    return result;
  }, [skins, activeWeapons, activeEditions, searchQuery]);

  const toggleWeapon = (weapon: string) => {
    setActiveWeapons(
      activeWeapons.includes(weapon)
        ? activeWeapons.filter((w) => w !== weapon)
        : [...activeWeapons, weapon]
    );
  };

  const toggleEdition = (tierName: string) => {
    setActiveEditions(
      activeEditions.includes(tierName)
        ? activeEditions.filter((e) => e !== tierName)
        : [...activeEditions, tierName]
    );
  };

  const clearAllFilters = () => {
    setSearchQuery("");
    setActiveWeapons([]);
    setActiveEditions([]);
  };

  const hasActiveFilters =
    activeWeapons.length > 0 || activeEditions.length > 0 || searchQuery.trim() !== "";

  return (
    <div className="space-y-6">
      {/* Search and Filter Controls */}
      <div className="space-y-4">
        {/* Search Input */}
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <svg
              className="h-5 w-5 text-zinc-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            placeholder="Search skins..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-void-deep border border-white/10 angular-card text-light placeholder-zinc-500 focus:outline-none focus:border-valorant-red/50 focus:ring-1 focus:ring-valorant-red/20 transition-all"
          />
        </div>

        {/* Weapon Filter Pills */}
        <div className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
            Weapon
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveWeapons([])}
              className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide angular-card-sm transition-all ${
                activeWeapons.length === 0
                  ? "bg-valorant-red text-white"
                  : "bg-void-deep border border-white/10 text-zinc-400 hover:border-valorant-red/50 hover:text-light"
              }`}
            >
              All
            </button>
            {weaponCategories.map((weapon) => (
              <button
                key={weapon}
                onClick={() => toggleWeapon(weapon)}
                className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide angular-card-sm transition-all ${
                  activeWeapons.includes(weapon)
                    ? "bg-valorant-red text-white"
                    : "bg-void-deep border border-white/10 text-zinc-400 hover:border-valorant-red/50 hover:text-light"
                }`}
              >
                {weapon}
              </button>
            ))}
          </div>
        </div>

        {/* Tier Filter Pills */}
        {editionCategories.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">
              Tier
            </span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveEditions([])}
                className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide angular-card-sm transition-all ${
                  activeEditions.length === 0
                    ? "bg-valorant-red text-white"
                    : "bg-void-deep border border-white/10 text-zinc-400 hover:border-valorant-red/50 hover:text-light"
                }`}
              >
                All
              </button>
              {editionCategories.map((tier) => {
                const isSelected = activeEditions.includes(tier.displayName);
                const tierColor = `#${tier.highlightColor.slice(0, 6)}`;
                return (
                  <button
                    key={tier.uuid}
                    onClick={() => toggleEdition(tier.displayName)}
                    className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide angular-card-sm transition-all flex items-center gap-2 ${
                      isSelected
                        ? "text-white"
                        : "bg-void-deep border border-white/10 text-zinc-400 hover:text-light"
                    }`}
                    style={
                      isSelected
                        ? { backgroundColor: tierColor, borderColor: tierColor }
                        : { borderColor: undefined }
                    }
                    onMouseEnter={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = `${tierColor}80`;
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) {
                        e.currentTarget.style.borderColor = "";
                      }
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: tierColor }}
                    />
                    {tier.displayName}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Count Display */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            Showing{" "}
            <span className="text-light font-semibold">{filteredSkins.length}</span> of{" "}
            <span className="text-light font-semibold">{skins.length}</span> skins
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearAllFilters}
              className="text-xs text-valorant-red hover:text-valorant-red/80 uppercase tracking-wide font-semibold transition-colors"
            >
              Clear All Filters
            </button>
          )}
        </div>
      </div>

      {/* Skins Grid */}
      {filteredSkins.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredSkins.map((skin) => (
            <EncyclopediaCard key={skin.uuid} skin={skin} />
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <div className="text-zinc-500">
            <svg
              className="h-16 w-16"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
          </div>
          <p className="text-zinc-400 text-center">
            No skins match your filters.
            <br />
            <button
              onClick={clearAllFilters}
              className="text-valorant-red hover:underline mt-2"
            >
              Clear filters
            </button>
          </p>
        </div>
      )}
    </div>
  );
}
