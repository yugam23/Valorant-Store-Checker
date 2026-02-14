"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { StoreItem } from "../../types/store";

interface StoreCardProps {
  item: StoreItem;
  staggerIndex?: number;
}

export function StoreCard({ item, staggerIndex = 0 }: StoreCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseEnter = () => {
    setIsHovered(true);
    if (videoRef.current && item.streamedVideo) {
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
      className="stagger-entrance"
      style={{ "--stagger-delay": `${staggerIndex * 100}ms` } as React.CSSProperties}
      role="article"
      aria-label={`${item.displayName}, ${item.cost.toLocaleString()} Valorant Points${item.tierName ? `, ${item.tierName} tier` : ''}`}
    >
      {/* Glow border wrapper — animated conic gradient colored by rarity tier */}
      <div
        className="glow-border angular-card"
        style={{ "--glow-color": item.tierColor } as React.CSSProperties}
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
              background: `radial-gradient(ellipse at center, ${item.tierColor}15 0%, transparent 70%)`,
            }}
          />

          {/* Card content */}
          <div className="relative p-6 space-y-4 z-10">
            {/* Skin image/video */}
            <div className="relative aspect-[16/9] w-full overflow-hidden bg-void/50">
              {/* Vignette overlay */}
              <div className="absolute inset-0 z-10 pointer-events-none bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(10,17,24,0.6)_100%)]" />

              {item.displayIcon && (
                <Image
                  src={item.displayIcon}
                  alt={item.displayName}
                  fill
                  className={`object-contain p-4 transition-all duration-300 ${
                    isHovered && item.streamedVideo ? "opacity-0" : "opacity-100 group-hover:scale-105"
                  }`}
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                  priority={staggerIndex < 2}
                />
              )}

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

              {!item.displayIcon && !item.streamedVideo && (
                <div className="flex items-center justify-center h-full text-zinc-500">
                  <span className="text-sm">No preview available</span>
                </div>
              )}
            </div>

            {/* Skin info */}
            <div className="space-y-2">
              <h3 className="font-display text-xl uppercase font-semibold text-light leading-tight line-clamp-2 min-h-[3.5rem]">
                {item.displayName}
              </h3>

              {/* Angular price separator */}
              <div className="h-[1px] w-full bg-gradient-to-r from-white/10 via-white/20 to-transparent" />

              <div className="flex items-center justify-between pt-1">
                <div className="flex items-center gap-2">
                  <Image src="/icons/Valorant_Points.webp" alt="VP" width={28} height={28} />
                  <span className="text-light font-bold text-xl font-mono tracking-wider">
                    {item.cost.toLocaleString()}
                  </span>
                </div>

                {item.tierName && (
                  <span
                    className="text-xs font-bold uppercase tracking-wider px-3 py-1 angular-card-sm"
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
          </div>
        </div>
      </div>
    </div>
  );
}
