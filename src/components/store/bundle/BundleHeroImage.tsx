"use client";

import { useState } from "react";
import Image from "next/image";
import type { BundleData } from "@/types/store";

interface BundleHeroImageProps {
  bundle: BundleData;
}

/** Hero banner image with dynamic item-collage fallback */
function BundleHeroImage({ bundle }: BundleHeroImageProps) {
  const [imgError, setImgError] = useState(false);

  // Use official image if available
  if (!imgError && bundle.displayIcon2) {
    return (
      <div className="relative w-full aspect-[21/9] overflow-hidden bg-void/50">
        <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(10,17,24,0.8)_100%)]" />
        <Image
          src={bundle.displayIcon2}
          alt={bundle.displayName}
          fill
          className="object-cover"
          sizes="100vw"
          priority
          onError={() => setImgError(true)}
        />
      </div>
    );
  }

  // Fallback: create a dynamic collage from bundle item images
  const heroItems = bundle.items
    .filter((item) => item.displayIcon)
    .slice(0, 4);

  return (
    <div className="relative w-full aspect-[21/9] overflow-hidden bg-gradient-to-br from-void-deep via-[#0e1a26] to-void-deep">
      {/* Subtle background pattern */}
      <div className="absolute inset-0 z-0 opacity-10" style={{
        backgroundImage: `repeating-linear-gradient(45deg, transparent, transparent 35px, rgba(240,178,50,0.08) 35px, rgba(240,178,50,0.08) 70px)`,
      }} />
      {/* Radial glow behind items */}
      <div className="absolute inset-0 z-0 opacity-40" style={{
        background: `radial-gradient(ellipse at 50% 60%, rgba(240,178,50,0.15) 0%, transparent 60%)`,
      }} />

      {heroItems.length > 0 ? (
        /* Item images arranged as an overlapping collage */
        <div className="absolute inset-0 z-[1] flex items-center justify-center">
          {heroItems.map((item, i) => {
            const count = heroItems.length;
            // Spread items across the hero area with slight overlap
            const offsetX = count === 1 ? 0 : ((i / (count - 1)) - 0.5) * 55;
            const scale = count === 1 ? 1.1 : 0.75 + (i === Math.floor(count / 2) ? 0.15 : 0);
            const rotation = count === 1 ? 0 : (i - Math.floor(count / 2)) * 3;

            return (
              <div
                key={item.uuid}
                className="absolute w-[40%] aspect-[16/9] transition-transform duration-500"
                style={{
                  transform: `translateX(${offsetX}%) scale(${scale}) rotate(${rotation}deg)`,
                  zIndex: i === Math.floor(count / 2) ? 3 : i + 1,
                  filter: i === Math.floor(count / 2) ? "none" : "brightness(0.7)",
                }}
              >
                <Image
                  src={item.displayIcon}
                  alt={item.displayName}
                  fill
                  className="object-contain drop-shadow-[0_4px_24px_rgba(240,178,50,0.2)]"
                  sizes="40vw"
                />
              </div>
            );
          })}
        </div>
      ) : (
        /* True fallback: no item images at all */
        <div className="absolute inset-0 z-[1] flex items-center justify-center">
          <div className="flex flex-col items-center gap-3 opacity-60">
            <svg className="w-16 h-16 text-[#F0B232]/40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
            </svg>
            <span className="text-zinc-500 text-sm font-display uppercase tracking-wider">Bundle Preview Unavailable</span>
          </div>
        </div>
      )}

      {/* Top/bottom edge vignette for seamless blending */}
      <div className="absolute inset-0 z-[2] pointer-events-none bg-gradient-to-b from-void-deep/60 via-transparent to-void-deep/80" />
      <div className="absolute inset-0 z-[2] pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_30%,rgba(10,17,24,0.85)_100%)]" />
    </div>
  );
}

export { BundleHeroImage };
