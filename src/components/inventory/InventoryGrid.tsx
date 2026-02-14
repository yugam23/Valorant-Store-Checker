"use client";

import { useState, useMemo } from "react";
import { InventoryCard } from "./InventoryCard";
import type { OwnedSkin } from "@/types/inventory";

interface InventoryGridProps {
  skins: OwnedSkin[];
  weaponCategories: string[];
}

export function InventoryGrid({ skins, weaponCategories }: InventoryGridProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState<string>("All");

  // Filter skins based on search query and weapon filter
  const filteredSkins = useMemo(() => {
    let result = skins;

    // Apply weapon filter
    if (activeFilter !== "All") {
      result = result.filter((skin) => skin.weaponName === activeFilter);
    }

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter((skin) =>
        skin.displayName.toLowerCase().includes(query)
      );
    }

    return result;
  }, [skins, activeFilter, searchQuery]);

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
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setActiveFilter("All")}
            className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide angular-card-sm transition-all ${
              activeFilter === "All"
                ? "bg-valorant-red text-white"
                : "bg-void-deep border border-white/10 text-zinc-400 hover:border-valorant-red/50 hover:text-light"
            }`}
          >
            All
          </button>
          {weaponCategories.map((weapon) => (
            <button
              key={weapon}
              onClick={() => setActiveFilter(weapon)}
              className={`px-4 py-2 text-sm font-semibold uppercase tracking-wide angular-card-sm transition-all ${
                activeFilter === weapon
                  ? "bg-valorant-red text-white"
                  : "bg-void-deep border border-white/10 text-zinc-400 hover:border-valorant-red/50 hover:text-light"
              }`}
            >
              {weapon}
            </button>
          ))}
        </div>

        {/* Count Display */}
        <p className="text-sm text-zinc-400">
          Showing <span className="text-light font-semibold">{filteredSkins.length}</span> of{" "}
          <span className="text-light font-semibold">{skins.length}</span> skins
        </p>
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
              onClick={() => {
                setSearchQuery("");
                setActiveFilter("All");
              }}
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
