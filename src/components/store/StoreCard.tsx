"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import type { StoreItem } from "../../types/store";
import { getEditionIconPath } from "@/lib/edition-icons";

interface StoreCardProps {
  item: StoreItem;
  staggerIndex?: number;
  isWishlisted?: boolean;
  onWishlistToggle?: (skinUuid: string, item: StoreItem) => void;
  showInStoreNotification?: boolean;
}

export function StoreCard({
  item,
  staggerIndex = 0,
  isWishlisted = false,
  onWishlistToggle,
  showInStoreNotification = false
}: StoreCardProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [isHovered, setIsHovered] = useState(false);
  const [isOptimisticallyWishlisted, setIsOptimisticallyWishlisted] = useState(isWishlisted);
  const [isPulsing, setIsPulsing] = useState(false);

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

  const handleHeartClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    if (!onWishlistToggle) return;

    // Optimistic UI update
    setIsOptimisticallyWishlisted(!isOptimisticallyWishlisted);
    setIsPulsing(true);
    setTimeout(() => setIsPulsing(false), 300);

    // Call parent handler
    onWishlistToggle(item.uuid, item);
  };

  // Sync optimistic state when prop changes
  if (isWishlisted !== isOptimisticallyWishlisted && !isPulsing) {
    setIsOptimisticallyWishlisted(isWishlisted);
  }

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

          {/* Heart button (wishlist toggle) */}
          {onWishlistToggle && (
            <button
              onClick={handleHeartClick}
              className={`absolute top-3 right-3 z-20 w-10 h-10 flex items-center justify-center rounded-full transition-all duration-300 ${
                isOptimisticallyWishlisted
                  ? "bg-valorant-red/20 hover:bg-valorant-red/30"
                  : "bg-void-deep/80 hover:bg-void-surface"
              } ${isPulsing ? "scale-125" : "scale-100"}`}
              aria-label={isOptimisticallyWishlisted ? "Remove from wishlist" : "Add to wishlist"}
            >
              <svg
                className={`w-5 h-5 transition-all duration-300 ${
                  isOptimisticallyWishlisted ? "fill-valorant-red scale-110" : "fill-none stroke-zinc-400"
                }`}
                viewBox="0 0 24 24"
                strokeWidth="2"
              >
                <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
              </svg>
            </button>
          )}

          {/* "IN YOUR STORE!" notification badge */}
          {showInStoreNotification && (
            <div className="absolute top-3 left-3 z-20 px-3 py-1 bg-[#F0B232] text-void-deep text-xs font-bold uppercase tracking-wider angular-card-sm animate-pulse-glow">
              In Your Store!
            </div>
          )}

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
                    className="text-xs font-bold uppercase tracking-wider px-2 py-1 angular-card-sm flex items-center gap-1.5 whitespace-nowrap"
                    style={{
                      backgroundColor: `${item.tierColor}20`,
                      color: item.tierColor,
                    }}
                  >
                    {getEditionIconPath(item.tierName) && (
                      <Image
                        src={getEditionIconPath(item.tierName)!}
                        alt=""
                        width={14}
                        height={14}
                        className="flex-shrink-0"
                      />
                    )}
                    {item.tierName.replace(" Edition", "")}
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
