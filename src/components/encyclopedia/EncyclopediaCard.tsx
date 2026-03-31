"use client";

import { memo, useEffect, useState } from "react";
import Image from "next/image";
import type { EncyclopediaCardProps } from "@/types/encyclopedia";
import { getEditionIconPath } from "@/lib/edition-icons";
import { fetchAndCacheBlurDataURL } from "@/lib/blur-utils";

export const EncyclopediaCard = memo(function EncyclopediaCard({ skin, isWishlisted, onWishlistToggle, staggerDelay = 0 }: EncyclopediaCardProps) {
  const [optimisticOverride, setOptimisticOverride] = useState<boolean | null>(null);
  const [isPulsing, setIsPulsing] = useState(false);
  const [wallpaperBlur, setWallpaperBlur] = useState<string>(skin.blurDataURL);
  const displayIsWishlisted = optimisticOverride ?? isWishlisted;

  // Lazily fetch wallpaper blur after mount — avoids 1000+ concurrent requests at page load.
  // Only visible cards (~20-30 in viewport) mount at once thanks to row virtualization.
  // Results are cached in fetchAndCacheBlurDataURL module cache.
  useEffect(() => {
    if (!skin.wallpaper) return;
    let mounted = true;
    // Stagger: random delay 0–800ms to spread out concurrent wallpaper fetches
    const delay = Math.random() * 800;
    const timer = setTimeout(() => {
      fetchAndCacheBlurDataURL(skin.wallpaper).then((blur) => {
        if (mounted) setWallpaperBlur(blur);
      });
    }, delay);
    return () => {
      mounted = false;
      clearTimeout(timer);
    };
  }, [skin.wallpaper]);

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!onWishlistToggle) return;

    setOptimisticOverride(!displayIsWishlisted);
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 300);

    onWishlistToggle(skin.uuid, skin);
  };

  const imageSrc = skin.displayIcon || skin.wallpaper || null;

  return (
    <div
      className="stagger-entrance"
      style={{ "--stagger-delay": `${staggerDelay}ms` } as React.CSSProperties}
      role="article"
      aria-label={`${skin.displayName}, ${skin.tierName} tier, ${skin.weaponName}`}
    >
      {/* Glow border wrapper */}
      <div
        className="glow-border angular-card"
        style={{ "--glow-color": skin.tierColor } as React.CSSProperties}
      >
        <div
          className="group relative overflow-hidden angular-card bg-void-deep"
        >
          {/* Inner radial glow on hover */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0"
            style={{
              background: `radial-gradient(ellipse at center, ${skin.tierColor}15 0%, transparent 70%)`,
            }}
          />

          {/* Heart button (wishlist toggle) */}
          {onWishlistToggle && (
            <button
              onClick={handleHeartClick}
              className={`absolute top-3 right-3 z-20 w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                displayIsWishlisted
                  ? "bg-valorant-red/20 hover:bg-valorant-red/30"
                  : "bg-void-deep/80 hover:bg-void-surface"
              } ${isPulsing ? "scale-125" : "scale-100"}`}
              aria-label={displayIsWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <svg
                className={`w-5 h-5 transition-all duration-300 ${
                  displayIsWishlisted ? "fill-valorant-red scale-110" : "fill-none stroke-zinc-400"
                }`}
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          )}

          {/* Card content */}
          <div className="relative p-4 space-y-3 z-10">
            {/* Skin image */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-void/50">
              {/* Vignette overlay */}
              <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(10,17,24,0.6)_100%)]" />

              {imageSrc ? (
                <Image
                  src={imageSrc}
                  alt={skin.displayName}
                  fill
                  placeholder="blur"
                  blurDataURL={wallpaperBlur}
                  className="object-contain p-3 transition-all duration-300 group-hover:scale-105"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
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
                {skin.displayName}
              </h3>

              {/* Angular separator */}
              <div className="h-[1px] w-full bg-gradient-to-r from-white/10 via-white/20 to-transparent" />

              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400 uppercase tracking-wide">
                  {skin.weaponName}
                </span>

                <span
                  className="text-xs font-bold uppercase tracking-wider px-2 py-1 angular-card-sm flex items-center gap-1.5"
                  style={{
                    backgroundColor: `${skin.tierColor}20`,
                    color: skin.tierColor,
                  }}
                >
                  {getEditionIconPath(skin.tierName) ? (
                    <Image
                      src={getEditionIconPath(skin.tierName)!}
                      alt=""
                      width={14}
                      height={14}
                      className="flex-shrink-0"
                    />
                  ) : (
                    <span
                      className="w-2 h-2 rounded-full flex-shrink-0"
                      style={{ backgroundColor: skin.tierColor }}
                    />
                  )}
                  {skin.tierName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});
