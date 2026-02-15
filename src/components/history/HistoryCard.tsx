"use client";

import { useState } from "react";
import { Trash2 } from "lucide-react";
import Image from "next/image";
import type { StoreRotation } from "@/types/history";
import { getEditionIconPath } from "@/lib/edition-icons";

interface HistoryCardProps {
  rotation: StoreRotation;
  staggerIndex: number;
  onDelete: (id: number) => void;
}

export function HistoryCard({ rotation, staggerIndex, onDelete }: HistoryCardProps) {
  const [confirming, setConfirming] = useState(false);
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
          <div className="flex items-center gap-3">
            <h3 className="font-display text-2xl uppercase text-light">
              {formattedDate}
            </h3>
            {rotation.gameName && (
              <span className="text-xs font-medium text-zinc-500 bg-void-deep/80 px-2 py-0.5 rounded">
                {rotation.gameName}
                {rotation.tagLine && <span className="text-zinc-600">#{rotation.tagLine}</span>}
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="text-sm uppercase tracking-wide">Total</span>
              <div className="flex items-center gap-1 font-bold text-light">
                <Image
                  src="/icons/Valorant_Points.webp"
                  alt="VP"
                  width={16}
                  height={16}
                  className="opacity-90"
                />
                <span>{totalCost.toLocaleString()}</span>
              </div>
            </div>
            {confirming ? (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => rotation.id != null && onDelete(rotation.id)}
                  className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-red-400 bg-red-500/10 border border-red-500/30 hover:bg-red-500/20 transition-colors rounded"
                >
                  Delete
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="px-2 py-1 text-xs font-medium uppercase tracking-wide text-zinc-400 bg-void-deep/50 border border-white/5 hover:text-zinc-300 transition-colors rounded"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setConfirming(true)}
                className="p-1.5 text-zinc-600 hover:text-red-400 transition-colors rounded"
                aria-label="Delete rotation"
              >
                <Trash2 size={14} />
              </button>
            )}
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
              {/* Item info */}
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-light truncate">
                  {item.displayName}
                </p>
                <div className="flex items-center gap-1 text-xs text-zinc-400">
                  {item.tierName && (
                    <span
                      className="font-bold uppercase tracking-wide flex items-center gap-1"
                      style={{ color: item.tierColor }}
                    >
                      {getEditionIconPath(item.tierName) && (
                        <Image
                          src={getEditionIconPath(item.tierName)!}
                          alt=""
                          width={12}
                          height={12}
                          className="flex-shrink-0"
                        />
                      )}
                      {item.tierName}
                    </span>
                  )}
                </div>
              </div>

              {/* Item cost */}
              <div className="flex items-center gap-1 text-sm font-bold text-light flex-shrink-0">
                <Image
                  src="/icons/Valorant_Points.webp"
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
