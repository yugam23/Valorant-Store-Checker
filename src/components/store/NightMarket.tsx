"use client";

import { useEffect, useState, useCallback } from "react";
import { NightMarketData } from "@/types/store";
import Image from "next/image";

interface NightMarketProps {
  nightMarket: NightMarketData;
}

/** Live-updating countdown for Night Market expiration */
function NightMarketTimer({ expiresAt }: { expiresAt: string | Date }) {
  const calcTime = useCallback(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return "Expired";

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    if (days > 0) {
      return `${days}d ${hours}h ${minutes}m remaining`;
    }
    if (hours > 0) {
      return `${hours}h ${minutes}m ${seconds}s remaining`;
    }
    return `${minutes}m ${seconds}s remaining`;
  }, [expiresAt]);

  const [timeRemaining, setTimeRemaining] = useState(calcTime());

  useEffect(() => {
    setTimeRemaining(calcTime());
    const id = setInterval(() => setTimeRemaining(calcTime()), 1000);
    return () => clearInterval(id);
  }, [calcTime]);

  return (
    <p
      className="text-zinc-400 text-sm"
      role="timer"
      aria-live="polite"
      aria-label={`Night market ${timeRemaining}`}
    >
      {timeRemaining}
    </p>
  );
}

export function NightMarket({ nightMarket }: NightMarketProps) {
  if (!nightMarket.items || nightMarket.items.length === 0) {
    return null;
  }

  return (
    <section className="mt-12" aria-label="Night Market">
      {/* Section Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="font-display text-4xl md:text-5xl font-bold uppercase text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-500 drop-shadow-[0_0_20px_rgba(168,85,247,0.4)]">
            Night Market
          </h2>
          <NightMarketTimer expiresAt={nightMarket.expiresAt} />
        </div>
        <div className="angular-card-sm px-4 py-2 bg-gradient-to-r from-purple-900/30 to-pink-900/30 border border-purple-500/30">
          <p className="text-xs text-purple-300 font-display uppercase tracking-wider">Bonus Store</p>
        </div>
      </div>

      {/* Night Market Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4" role="list" aria-label="Night market offers">
        {nightMarket.items.map((item, index) => (
          <div
            key={item.uuid}
            className="stagger-entrance"
            style={{ "--stagger-delay": `${index * 100}ms` } as React.CSSProperties}
            role="listitem"
            aria-label={`${item.displayName}, ${item.discountedPrice.toLocaleString()} VP, ${item.discountPercent}% off`}
          >
            {/* Purple glow border */}
            <div
              className="glow-border angular-card"
              style={{ "--glow-color": "rgba(168, 85, 247, 0.6)" } as React.CSSProperties}
            >
              <div className="group relative angular-card bg-void-deep overflow-hidden transition-all duration-300 hover:scale-[1.02] hover:shadow-[0_0_30px_rgba(168,85,247,0.2)]">
                {/* Discount Badge */}
                <div className="absolute top-3 right-3 z-10 angular-card-sm bg-gradient-to-r from-pink-600 to-purple-600 text-white px-3 py-1 text-sm font-bold shadow-lg" aria-label={`${item.discountPercent}% discount`}>
                  -{item.discountPercent}%
                </div>

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
                    <p className="text-xs text-zinc-400 font-display uppercase tracking-wider">
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

                  {!item.isSeen && (
                    <div className="absolute top-3 left-3 w-2 h-2 bg-pink-500 animate-pulse-glow" style={{ clipPath: "polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)" }} aria-label="New offer" />
                  )}
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
