/**
 * StoreGrid Component
 *
 * Responsive grid layout for displaying daily store items
 * Uses Bento Grid system from "Void & Light" design
 *
 * Layout:
 * - Mobile: 1 column
 * - Tablet: 2 columns
 * - Desktop: 4 columns
 * - Gap: 16px (desktop), 12px (mobile)
 */

"use client";

import type { StoreItem } from "../../types/store";
import { StoreCard } from "./StoreCard";

interface StoreGridProps {
  items: StoreItem[];
}

export function StoreGrid({ items }: StoreGridProps) {
  if (!items || items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-20 space-y-4">
        <div className="text-6xl">🛒</div>
        <p className="text-zinc-300 text-lg">No items in store today</p>
        <p className="text-zinc-500 text-sm">Check back later</p>
      </div>
    );
  }

  return (
    <div className="w-full">
      {/* Grid container */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-3 md:gap-4">
        {items.map((item) => (
          <StoreCard key={item.uuid} item={item} />
        ))}
      </div>

      {/* Store info footer */}
      <div className="mt-8 text-center text-zinc-500 text-sm">
        <p>Daily store rotates every 24 hours</p>
      </div>
    </div>
  );
}
