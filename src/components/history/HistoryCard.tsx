"use client";

import Image from "next/image";
import type { StoreRotation } from "@/types/history";

interface HistoryCardProps {
  rotation: StoreRotation;
  staggerIndex: number;
}

export function HistoryCard({ rotation, staggerIndex }: HistoryCardProps) {
  // Format date as "Wednesday, February 15, 2026"
  const formattedDate = new Date(rotation.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  // Calculate total daily cost
  const totalCost = rotation.items.reduce((sum, item) => sum + item.cost, 0);

  return (
    <div
      className="angular-card bg-void-surface/50 hover:bg-void-surface/70 transition-all duration-300 animate-slide-in-right"
      style={{ "--stagger-delay": `${staggerIndex * 100}ms` } as React.CSSProperties}
    >
      <div className="p-6 space-y-4">
        {/* Date header */}
        <div className="flex items-center justify-between">
          <h3 className="font-display text-2xl uppercase text-light">
            {formattedDate}
          </h3>
          <div className="flex items-center gap-2 text-zinc-400">
            <span className="text-sm uppercase tracking-wide">Total</span>
            <div className="flex items-center gap-1 font-bold text-light">
              <Image
                src="/icons/VP.webp"
                alt="VP"
                width={16}
                height={16}
                className="opacity-90"
              />
              <span>{totalCost.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Angular separator */}
        <div className="h-[1px] w-full bg-gradient-to-r from-white/10 via-white/20 to-transparent" />

        {/* Items grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {rotation.items.map((item, index) => (
            <div
              key={item.uuid + index}
              className="flex items-center gap-3 p-3 bg-void-deep/50 rounded-lg border-l-2 transition-colors duration-200 hover:bg-void-deep/70"
              style={{ borderColor: item.tierColor }}
            >
              {/* Item icon */}
              <div className="relative w-12 h-12 flex-shrink-0">
                <Image
                  src="/icons/weapon-placeholder.png"
                  alt={item.displayName}
                  width={48}
                  height={48}
                  className="object-contain opacity-80"
                />
              </div>

              {/* Item info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-light truncate">
                  {item.displayName}
                </p>
                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  {item.tierName && (
                    <span
                      className="font-bold uppercase tracking-wide"
                      style={{ color: item.tierColor }}
                    >
                      {item.tierName}
                    </span>
                  )}
                </div>
              </div>

              {/* Item cost */}
              <div className="flex items-center gap-1 text-sm font-bold text-light flex-shrink-0">
                <Image
                  src="/icons/VP.webp"
                  alt="VP"
                  width={14}
                  height={14}
                  className="opacity-90"
                />
                <span>{item.cost.toLocaleString()}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
