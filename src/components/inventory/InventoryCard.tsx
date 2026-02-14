"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { OwnedSkin } from "@/types/inventory";

interface InventoryCardProps {
  skin: OwnedSkin;
}

export function InventoryCard({ skin }: InventoryCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current && skin.streamedVideo) {
      videoRef.current.play().catch((error) => {
        console.debug("Video play prevented:", error);
      });
    }
  };

  const handleMouseLeave = () => {
    setIsHovered(false);
    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.currentTime = 0;
    }
  };

  return (
    <div
      role="article"
      aria-label={`${skin.displayName}${skin.tierName ? `, ${skin.tierName} tier` : ''}, ${skin.weaponName}`}
    >
      {/* Glow border wrapper */}
      <div
        className="glow-border angular-card"
        style={{ "--glow-color": skin.tierColor } as React.CSSProperties}
      >
        <div
          className="group relative overflow-hidden angular-card bg-void-deep"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {/* Inner radial glow on hover */}
          <div
            className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none z-0"
            style={{
              background: `radial-gradient(ellipse at center, ${skin.tierColor}15 0%, transparent 70%)`,
            }}
          />

          {/* Card content */}
          <div className="relative p-4 space-y-3 z-10">
            {/* Skin image/video */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-void/50">
              {/* Vignette overlay */}
              <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(10,17,24,0.6)_100%)]" />

              {skin.displayIcon && (
                <Image
                  src={skin.displayIcon}
                  alt={skin.displayName}
                  fill
                  className={`object-contain p-3 transition-all duration-300 ${
                    isHovered && skin.streamedVideo ? "opacity-0" : "opacity-100 group-hover:scale-105"
                  }`}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 25vw"
                />
              )}

              {skin.streamedVideo && (
                <video
                  ref={videoRef}
                  src={skin.streamedVideo}
                  className={`absolute inset-0 w-full h-full object-contain p-3 transition-opacity duration-300 ${
                    isHovered ? "opacity-100" : "opacity-0"
                  }`}
                  muted
                  loop
                  playsInline
                  preload="metadata"
                />
              )}

              {!skin.displayIcon && !skin.streamedVideo && (
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

                {skin.tierName && (
                  <span
                    className="text-xs font-bold uppercase tracking-wider px-2 py-1 angular-card-sm"
                    style={{
                      backgroundColor: `${skin.tierColor}20`,
                      color: skin.tierColor,
                    }}
                  >
                    {skin.tierName}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
