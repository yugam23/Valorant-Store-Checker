"use client";

import Image from "next/image";
import type { EncyclopediaSkin } from "@/types/encyclopedia";

interface EncyclopediaCardProps {
  skin: EncyclopediaSkin;
}

export function EncyclopediaCard({ skin }: EncyclopediaCardProps) {
  const imageSrc = skin.displayIcon || skin.wallpaper || null;

  return (
    <div
      role="article"
      aria-label={`${skin.displayName}, ${skin.tierName} tier, ${skin.weaponName}`}
    >
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
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ backgroundColor: skin.tierColor }}
                  />
                  {skin.tierName}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
