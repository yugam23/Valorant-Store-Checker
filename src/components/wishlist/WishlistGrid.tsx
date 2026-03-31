"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import type { WishlistItem } from "@/types/wishlist";
import type { EncyclopediaSkin } from "@/types/encyclopedia";
import { getBlurDataURL } from "@/lib/blur-utils";

interface WishlistGridProps {
  items: WishlistItem[];
  ownedSet: Set<string>;
  onRemove: (skinUuid: string) => void;
}

/**
 * Converts a WishlistItem into a minimal EncyclopediaSkin-like object
 * for card rendering.
 */
function toSkin(item: WishlistItem): EncyclopediaSkin {
  return {
    uuid: item.skinUuid,
    displayName: item.displayName,
    displayIcon: item.displayIcon,
    wallpaper: null,
    blurDataURL: getBlurDataURL(null),
    weaponName: "",
    tierName: "",
    tierColor: item.tierColor,
    contentTierUuid: null,
  };
}

function WishlistSkinCard({
  item,
  isOwned,
  onRemove,
}: {
  item: WishlistItem;
  isOwned: boolean;
  onRemove: (skinUuid: string) => void;
}) {
  const skin = toSkin(item);
  const [_optimisticOwned] = useState(isOwned);

  return (
    <div role="article" aria-label={`${item.displayName}${isOwned ? ", owned" : ""}`}>
      {/* Glow border wrapper */}
      <div
        className="glow-border angular-card"
        style={{ "--glow-color": skin.tierColor } as React.CSSProperties}
      >
        <div className="group relative overflow-hidden angular-card bg-void-deep">
          {/* Inner radial glow on hover */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0"
            style={{
              background: `radial-gradient(ellipse at center, ${skin.tierColor}15 0%, transparent 70%)`,
            }}
          />

          {/* OWNED badge */}
          {isOwned && (
            <div className="absolute top-3 left-3 z-20 bg-green-500/20 text-green-400 text-xs font-bold uppercase px-2 py-1 angular-card-sm">
              Owned
            </div>
          )}

          {/* Heart button (remove from wishlist) */}
          <button
            onClick={() => onRemove(item.skinUuid)}
            className="absolute top-3 right-3 z-20 w-10 h-10 flex items-center justify-center rounded-full bg-valorant-red/20 hover:bg-valorant-red/30 transition-all"
            aria-label={`Remove ${item.displayName} from wishlist`}
          >
            <svg
              className="w-5 h-5 fill-valorant-red scale-110"
              viewBox="0 0 24 24"
              strokeWidth="2"
            >
              <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
            </svg>
          </button>

          {/* Card content */}
          <div className="relative p-4 space-y-3 z-10">
            {/* Skin image */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-void/50">
              {/* Vignette overlay */}
              <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(10,17,24,0.6)_100%)]" />

              {item.displayIcon ? (
                <Image
                  src={item.displayIcon}
                  alt={item.displayName}
                  fill
                  className="object-contain p-3 transition-all duration-300 group-hover:scale-105"
                  sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                />
              ) : (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  <span className="text-xs">No preview</span>
                </div>
              )}
            </div>

            {/* Skin info */}
            <div className="space-y-2">
              <h3 className="font-display text-base uppercase font-semibold text-light leading-tight line-clamp-2 min-h-[2.5rem]">
                {item.displayName}
              </h3>

              {/* Angular separator */}
              <div className="h-[1px] w-full bg-gradient-to-r from-white/10 via-white/20 to-transparent" />

              <div className="flex items-center justify-end">
                <span
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: skin.tierColor }}
                  title="Tier color"
                />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="angular-card bg-void-surface/50 p-12 text-center space-y-4">
      <svg
        className="w-16 h-16 mx-auto text-zinc-600"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.5}
          d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
        />
      </svg>
      <div>
        <p className="text-zinc-300 font-display uppercase tracking-wider text-lg">
          Your wishlist is empty
        </p>
        <p className="text-zinc-500 text-sm mt-2">
          Browse the encyclopedia and heart skins you want!
        </p>
      </div>
      <Link
        href="/encyclopedia"
        className="inline-block px-6 py-3 bg-valorant-red text-white text-sm font-bold uppercase angular-card-sm hover:bg-valorant-red/80 transition-colors"
      >
        Browse the Encyclopedia
      </Link>
    </div>
  );
}

export function WishlistGrid({ items, ownedSet, onRemove }: WishlistGridProps) {
  if (items.length === 0) {
    return <EmptyState />;
  }

  return (
    <div className="space-y-6">
      {/* Header row with Browse All button */}
      <div className="flex items-center justify-end">
        <Link
          href="/encyclopedia"
          className="px-4 py-2 bg-valorant-red text-white text-sm font-bold uppercase angular-card-sm hover:bg-valorant-red/80 transition-colors"
        >
          Browse All
        </Link>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {items.map((item) => (
          <WishlistSkinCard
            key={item.skinUuid}
            item={item}
            isOwned={ownedSet.has(item.skinUuid)}
            onRemove={onRemove}
          />
        ))}
      </div>
    </div>
  );
}
