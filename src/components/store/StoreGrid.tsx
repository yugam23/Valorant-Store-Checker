"use client";

import type { StoreItem } from "../../types/store";
import { StoreCard } from "./StoreCard";

interface StoreGridProps {
  items: StoreItem[];
  wishlistedUuids?: string[];
  onWishlistToggle?: (skinUuid: string, item: StoreItem) => void;
  showInStoreNotifications?: boolean;
}

export function StoreGrid({
  items,
  wishlistedUuids = [],
  onWishlistToggle,
  showInStoreNotifications = false,
}: StoreGridProps) {
  if (!items || items.length === 0) {
    return (
      <div className="angular-card bg-void-surface flex flex-col items-center justify-center py-20 space-y-4">
        <p className="text-zinc-300 text-lg font-display uppercase tracking-wider">No items in store today</p>
        <p className="text-zinc-500 text-sm">Check back later</p>
      </div>
    );
  }

  const isWishlisted = (uuid: string) => {
    return wishlistedUuids.some(
      (wishlistedUuid) => wishlistedUuid.toLowerCase() === uuid.toLowerCase()
    );
  };

  return (
    <div className="w-full">
      {/* Section badge */}
      <div className="flex items-center gap-4 mb-6">
        <span className="font-display text-sm uppercase tracking-[0.2em] text-zinc-400">
          Featured Offers
        </span>
        <div className="flex-1 h-[1px] bg-gradient-to-r from-valorant-red/40 to-transparent" />
      </div>

      {/* Grid container */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {items.map((item, index) => (
          <StoreCard
            key={item.uuid}
            item={item}
            staggerIndex={index}
            isWishlisted={isWishlisted(item.uuid)}
            onWishlistToggle={onWishlistToggle}
            showInStoreNotification={
              showInStoreNotifications && isWishlisted(item.uuid)
            }
          />
        ))}
      </div>

      {/* Angular footer divider */}
      <div className="mt-8 flex items-center gap-4">
        <div className="flex-1 h-[1px] bg-gradient-to-r from-transparent to-white/10" />
        <p className="text-zinc-500 text-xs font-display uppercase tracking-wider">
          Daily store rotates every 24 hours
        </p>
        <div className="flex-1 h-[1px] bg-gradient-to-l from-transparent to-white/10" />
      </div>
    </div>
  );
}
