"use client";

import { useWishlist } from "@/hooks/useWishlist";
import { useCountdown } from "@/hooks/useCountdown";
import { NightMarketData } from "@/types/store";
import Image from "next/image";
import { getEditionIconPath } from "@/lib/edition-icons";

import type { NightMarketItem } from "@/types/store";

interface NightMarketProps {
  nightMarket: NightMarketData;
  wishlistSet?: Set<string>;
  onWishlistToggle?: (skinUuid: string, item: NightMarketItem) => Promise<void>;
}

export function NightMarket({ nightMarket, wishlistSet, onWishlistToggle }: NightMarketProps) {
  const timeLeft = useCountdown(nightMarket.expiresAt);

  if (!nightMarket.items || nightMarket.items.length === 0) {
    return null;
  }

  return (
    <section className="mt-12" aria-label="Night Market">
      {/* Section Header */}
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="font-display text-4xl md:text-5xl font-bold uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]">
            Night Market
          </h2>
          <p className="text-zinc-400 text-sm" role="timer" aria-live="polite" aria-label={`Night market ${timeLeft.formatted}`}>
            {timeLeft.formatted}
          </p>
        </div>
        <div className="angular-card-sm px-4 py-2 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30">
          <p className="text-xs text-purple-300 font-display uppercase tracking-wider">Bonus Store</p>
        </div>
      </div>

      {/* Night Market Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Night market offers">
        {nightMarket.items.map((item, index) => {
          const isWishlisted = wishlistSet?.has(item.uuid.toLowerCase()) ?? false;
          return (
          <div
            key={item.uuid}
            className="stagger-entrance"
            style={{ "--stagger-delay": `${index * 100}ms` } as React.CSSProperties}
            role="listitem"
            aria-label={`${item.displayName}, ${item.discountedPrice.toLocaleString()} VP, ${item.discountPercent}% off`}
          >
            {/* Glow border (red for wishlisted, purple default) */}
            <div
              className="glow-border w-full"
              style={{ "--glow-color": isWishlisted ? "var(--color-valorant-red)" : "rgba(168, 85, 247, 0.6)" } as React.CSSProperties}
            >
              <div className="group relative w-full max-w-full angular-card bg-void-deep overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                {/* Discount Badge */}
                <div className="absolute top-3 right-3 z-10 angular-card-sm bg-gradient-to-r from-pink-600 to-purple-600 text-white px-3 py-1 text-sm font-bold shadow-lg" aria-label={`${item.discountPercent}% discount`}>
                  -{item.discountPercent}%
                </div>

                {/* Heart button — above discount badge */}
                {onWishlistToggle && (
                  <button
                    onClick={() => onWishlistToggle(item.uuid, item)}
                    className={`absolute top-3 right-16 z-30 w-10 h-10 flex items-center justify-center rounded-full transition-all ${
                      isWishlisted
                        ? "bg-valorant-red/20 hover:bg-valorant-red/30"
                        : "bg-void-deep/80 hover:bg-void-surface"
                    }`}
                    aria-label={isWishlisted ? "Remove from wishlist" : "Add to wishlist"}
                  >
                    <svg
                      className={`w-5 h-5 transition-all duration-300 ${
                        isWishlisted ? "fill-valorant-red scale-110" : "fill-none stroke-zinc-400"
                      }`}
                      viewBox="0 0 24 24"
                      strokeWidth="2"
                    >
                      <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                    </svg>
                  </button>
                )}

                {/* Wishlisted Badge — top-left, above isSeen dot */}
                {isWishlisted && (
                  <div className="absolute top-3 left-3 z-20 px-3 py-1 bg-valorant-red text-white text-xs font-bold uppercase tracking-wider angular-card-sm animate-pulse-glow">
                    Wishlisted
                  </div>
                )}

                {/* isSeen dot — below wishlist badge, left side */}
                {!item.isSeen && (
                  <div className="absolute top-8 left-3 z-10 w-2 h-2 bg-pink-500 animate-pulse-glow" style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} aria-label="New offer" />
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
                    <div className="w-full h-full bg-void-surface flex items-center justify-center">
                      <span className="text-zinc-600 text-sm">No Image</span>
                    </div>
                  )}
                </div>

                {/* Item Info */}
                <div className="p-4 space-y-3">
                  <h3 className="font-display text-xl uppercase font-semibold text-white leading-tight line-clamp-2">
                    {item.displayName}
                  </h3>

                  {item.tierName && (
                    <p className="text-xs text-zinc-400 font-display uppercase tracking-wider flex items-center gap-1.5">
                      {getEditionIconPath(item.tierName) && (
                        <Image
                          src={getEditionIconPath(item.tierName)!}
                          alt=""
                          width={14}
                          height={14}
                          className="flex-shrink-0"
                        />
                      )}
                      {item.tierName}
                    </p>
                  )}

                  {/* Pricing */}
                  <div className="flex items-center justify-between pt-2">
                    <div className="h-[1px] flex-1 bg-gradient-to-r from-purple-500/30 to-transparent" />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex flex-col">
                      <p className="text-xs text-zinc-500 line-through flex items-center gap-1">
                        {item.basePrice.toLocaleString()}
                        <Image src="/icons/Valorant_Points.webp" alt="VP" width={14} height={14} />
                      </p>
                      <p className="text-xl font-bold font-mono tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-pink-400 to-purple-400 flex items-center gap-1">
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
                </div>
              </div>
            </div>
          </div>
          );
        })}
      </div>
    </section>
  );
}
