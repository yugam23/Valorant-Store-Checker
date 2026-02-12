/**
 * NightMarket Component
 *
 * Displays Night Market (Bonus Store) items with discount information.
 * Only renders when Night Market is active.
 * Features dark/purple theme to differentiate from Daily Store.
 */

"use client";

import { NightMarketData } from "@/types/store";
import Image from "next/image";

interface NightMarketProps {
  nightMarket: NightMarketData;
}

export function NightMarket({ nightMarket }: NightMarketProps) {
  if (!nightMarket.items || nightMarket.items.length === 0) {
    return null;
  }

  // Calculate time until Night Market expires
  const getTimeRemaining = () => {
    const now = new Date();
    const expires = new Date(nightMarket.expiresAt);
    const diff = expires.getTime() - now.getTime();

    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return `${days}d ${hours}h remaining`;
    }
    return `${hours}h remaining`;
  };

  return (
    <section className="mt-12">
      {/* Section Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-3xl md:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-600">
            Night Market
          </h2>
          <p className="text-zinc-400 text-sm mt-1">{getTimeRemaining()}</p>
        </div>
        <div className="px-4 py-2 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30 rounded-lg">
          <p className="text-xs text-purple-300 font-medium">BONUS STORE</p>
        </div>
      </div>

      {/* Night Market Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {nightMarket.items.map((item) => (
          <div
            key={item.uuid}
            className="group relative bg-gradient-to-br from-zinc-900 to-purple-950/40 rounded-2xl overflow-hidden border border-purple-500/20 hover:border-purple-500/50 transition-all duration-300 hover:scale-[1.02]"
          >
            {/* Discount Badge */}
            <div className="absolute top-3 right-3 z-10 bg-gradient-to-r from-pink-600 to-purple-600 text-white px-3 py-1 rounded-full text-sm font-bold shadow-lg">
              -{item.discountPercent}%
            </div>

            {/* Rarity Indicator */}
            {item.tierColor && (
              <div
                className="absolute bottom-0 left-0 right-0 h-1"
                style={{ backgroundColor: item.tierColor }}
              />
            )}

            {/* Image Container */}
            <div className="relative h-48 bg-gradient-to-b from-transparent to-black/40 flex items-center justify-center p-6">
              {item.displayIcon ? (
                <Image
                  src={item.displayIcon}
                  alt={item.displayName}
                  width={280}
                  height={140}
                  className="object-contain drop-shadow-2xl group-hover:scale-110 transition-transform duration-300"
                />
              ) : (
                <div className="w-full h-full bg-zinc-800 rounded-lg flex items-center justify-center">
                  <span className="text-zinc-600 text-sm">No Image</span>
                </div>
              )}
            </div>

            {/* Item Info */}
            <div className="p-4 space-y-3">
              {/* Name */}
              <h3 className="font-bold text-white text-lg leading-tight line-clamp-2">
                {item.displayName}
              </h3>

              {/* Tier */}
              {item.tierName && (
                <p className="text-xs text-zinc-400 uppercase tracking-wide">
                  {item.tierName}
                </p>
              )}

              {/* Pricing */}
              <div className="flex items-center justify-between pt-2 border-t border-zinc-800">
                <div className="flex flex-col">
                  <p className="text-xs text-zinc-500 line-through flex items-center gap-1">
                    {item.basePrice.toLocaleString()}
                    <Image src="/icons/Valorant_Points.webp" alt="VP" width={14} height={14} />
                  </p>
                  <p className="text-xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 flex items-center gap-1">
                    {item.discountedPrice.toLocaleString()}
                    <Image src="/icons/Valorant_Points.webp" alt="VP" width={20} height={20} />
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-green-400 font-medium flex items-center gap-1">
                    Save {(item.basePrice - item.discountedPrice).toLocaleString()}
                    <Image src="/icons/Valorant_Points.webp" alt="VP" width={12} height={12} />
                  </p>
                </div>
              </div>

              {/* Seen Status (Optional Visual Indicator) */}
              {!item.isSeen && (
                <div className="absolute top-3 left-3 w-2 h-2 bg-pink-500 rounded-full animate-pulse" />
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
