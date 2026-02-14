"use client";

import { useState, useMemo } from "react";
import { InventoryCard } from "./InventoryCard";
import type { OwnedSkin, EditionCategory } from "@/types/inventory";

interface InventoryGridProps {
  skins: OwnedSkin[];
  weaponCategories: string[];
  editionCategories: EditionCategory[];
}

export function InventoryGrid({ skins, weaponCategories, editionCategories }: InventoryGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeWeapon, setActiveWeapon] = useState<string>("All");
  const [activeEdition, setActiveEdition] = useState<string>("All");

  // Filter skins based on search query, weapon filter, and edition filter
  const filteredSkins = useMemo(() => {
    let result = skins;

    // Apply weapon filter
    if (activeWeapon !== "All") {
      result = result.filter((skin) => skin.weaponName === activeWeapon);
    }

    // Apply edition filter
    if (activeEdition !== "All") {
      result = result.filter((skin) => skin.tierName === activeEdition);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((skin) =>
        skin.displayName.toLowerCase().includes(query)
      );
    }

    return result;
  }, [skins, activeWeapon, activeEdition, searchQuery]);

  const clearAllFilters = () => {
    setSearchQuery("");
    setActiveWeapon("All");
    setActiveEdition("All");
  };

  const hasActiveFilters = activeWeapon !== "All" || activeEdition !== "All" || searchQuery.trim() !== "";

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
          <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Weapon</span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setActiveWeapon("All")}
              className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide angular-card-sm transition-all ${
                activeWeapon === "All"
                  ? "bg-valorant-red text-white"
                  : "bg-void-deep border border-white/10 text-zinc-400 hover:border-valorant-red/50 hover:text-light"
              }`}
            >
              All
            </button>
            {weaponCategories.map((weapon) => (
              <button
                key={weapon}
                onClick={() => setActiveWeapon(weapon)}
                className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide angular-card-sm transition-all ${
                  activeWeapon === weapon
                    ? "bg-valorant-red text-white"
                    : "bg-void-deep border border-white/10 text-zinc-400 hover:border-valorant-red/50 hover:text-light"
                }`}
              >
                {weapon}
              </button>
            ))}
          </div>
        </div>

        {/* Edition Filter Pills */}
        {editionCategories.length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-zinc-500">Edition</span>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setActiveEdition("All")}
                className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide angular-card-sm transition-all ${
                  activeEdition === "All"
                    ? "bg-valorant-red text-white"
                    : "bg-void-deep border border-white/10 text-zinc-400 hover:border-valorant-red/50 hover:text-light"
                }`}
              >
                All
              </button>
              {editionCategories.map((edition) => (
                <button
                  key={edition.name}
                  onClick={() => setActiveEdition(edition.name)}
                  className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide angular-card-sm transition-all flex items-center gap-2 ${
                    activeEdition === edition.name
                      ? "text-white"
                      : "bg-void-deep border border-white/10 text-zinc-400 hover:text-light"
                  }`}
                  style={
                    activeEdition === edition.name
                      ? { backgroundColor: edition.color, borderColor: edition.color }
                      : { borderColor: undefined }
                  }
                  onMouseEnter={(e) => {
                    if (activeEdition !== edition.name) {
                      e.currentTarget.style.borderColor = `${edition.color}80`;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (activeEdition !== edition.name) {
                      e.currentTarget.style.borderColor = "";
                    }
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: edition.color }}
                  />
                  {edition.name}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Count Display */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-zinc-400">
            Showing <span className="text-light font-semibold">{filteredSkins.length}</span> of{" "}
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
            <InventoryCard key={skin.uuid} skin={skin} />
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
