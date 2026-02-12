/**
 * StoreCard Component
 *
 * Displays a single weapon skin from the daily store
 * Features:
 * - High-quality skin image
 * - Skin name and price
 * - Rarity indicator (colored underline)
 * - Hover effects and animations
 *
 * Design System: "Void & Light"
 */

"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { StoreItem } from "../../types/store";

interface StoreCardProps {
  item: StoreItem;
}

export function StoreCard({ item }: StoreCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current && item.streamedVideo) {
      videoRef.current.play().catch((error) => {
        // Ignore play errors (e.g., video not loaded yet)
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
      className="group relative overflow-hidden rounded-3xl bg-zinc-900 border border-zinc-800"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {/* Rarity indicator - 2px colored underline at top */}
      <div
        className="absolute top-0 left-0 right-0 h-0.5 z-10"
        style={{ backgroundColor: item.tierColor }}
      />

      {/* Card content */}
      <div className="relative p-6 space-y-4">
        {/* Skin image/video */}
        <div className="relative aspect-[16/9] w-full overflow-hidden rounded-2xl bg-zinc-950">
          {/* Static image - always visible */}
          {item.displayIcon && (
            <Image
              src={item.displayIcon}
              alt={item.displayName}
              fill
              className={`object-contain p-4 transition-all duration-300 ${
                isHovered && item.streamedVideo ? "opacity-0" : "opacity-100 group-hover:scale-105"
              }`}
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              priority
            />
          )}

          {/* Video preview - shows on hover if available */}
          {item.streamedVideo && (
            <video
              ref={videoRef}
              src={item.streamedVideo}
              className={`absolute inset-0 w-full h-full object-contain p-4 transition-opacity duration-300 ${
                isHovered ? "opacity-100" : "opacity-0"
              }`}
              muted
              loop
              playsInline
              preload="metadata"
            />
          )}

          {/* Fallback for no media */}
          {!item.displayIcon && !item.streamedVideo && (
            <div className="flex items-center justify-center h-full text-zinc-500">
              <span className="text-sm">No preview available</span>
            </div>
          )}
        </div>

        {/* Skin info */}
        <div className="space-y-2">
          {/* Skin name */}
          <h3 className="text-foreground font-medium text-lg leading-tight line-clamp-2 min-h-[3.5rem]">
            {item.displayName}
          </h3>

          {/* Price and tier */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {/* VP icon placeholder - using emoji for now */}
              <span className="text-2xl" aria-label="Valorant Points">
                💎
              </span>
              <span className="text-foreground font-bold text-xl">
                {item.cost.toLocaleString()}
              </span>
            </div>

            {/* Tier badge */}
            {item.tierName && (
              <span
                className="text-xs font-medium px-3 py-1 rounded-full"
                style={{
                  backgroundColor: `${item.tierColor}20`,
                  color: item.tierColor,
                }}
              >
                {item.tierName}
              </span>
            )}
          </div>
        </div>

        {/* Hover overlay for future video preview */}
        <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300 pointer-events-none rounded-3xl" />
      </div>
    </div>
  );
}
