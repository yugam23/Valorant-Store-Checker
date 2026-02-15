"use client";

import { Calendar, Layers, TrendingUp, Coins } from "lucide-react";
import Image from "next/image";
import type { HistoryStats } from "@/types/history";

interface HistoryStatsProps {
  stats: HistoryStats;
}

export function HistoryStats({ stats }: HistoryStatsProps) {
  // If no data, show muted state
  if (stats.totalRotationsSeen === 0) {
    return (
      <div className="angular-card-sm bg-void-surface/30 p-8 text-center">
        <p className="text-zinc-500 text-sm uppercase tracking-wider">
          No data yet — visit your store to start tracking
        </p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {/* Rotations Seen */}
      <div className="angular-card-sm bg-void-surface/50 p-4 space-y-2 hover:bg-void-surface/70 transition-colors duration-200">
        <div className="flex items-center gap-2 text-zinc-400">
          <Calendar size={16} />
          <span className="text-xs uppercase tracking-wider">Rotations Seen</span>
        </div>
        <p className="font-display text-2xl text-light">
          {stats.totalRotationsSeen}
        </p>
      </div>

      {/* Unique Skins */}
      <div className="angular-card-sm bg-void-surface/50 p-4 space-y-2 hover:bg-void-surface/70 transition-colors duration-200">
        <div className="flex items-center gap-2 text-zinc-400">
          <Layers size={16} />
          <span className="text-xs uppercase tracking-wider">Unique Skins</span>
        </div>
        <p className="font-display text-2xl text-light">
          {stats.uniqueSkinsOffered}
        </p>
      </div>

      {/* Most Offered */}
      <div className="angular-card-sm bg-void-surface/50 p-4 space-y-2 hover:bg-void-surface/70 transition-colors duration-200">
        <div className="flex items-center gap-2 text-zinc-400">
          <TrendingUp size={16} />
          <span className="text-xs uppercase tracking-wider">Most Offered</span>
        </div>
        <p className="font-display text-xl text-light truncate" title={stats.mostOfferedSkin.displayName}>
          {stats.mostOfferedSkin.displayName}
        </p>
        <p className="text-xs text-zinc-400">
          {stats.mostOfferedSkin.count} times
        </p>
      </div>

      {/* Avg Daily Cost */}
      <div className="angular-card-sm bg-void-surface/50 p-4 space-y-2 hover:bg-void-surface/70 transition-colors duration-200">
        <div className="flex items-center gap-2 text-zinc-400">
          <Coins size={16} />
          <span className="text-xs uppercase tracking-wider">Avg Daily Cost</span>
        </div>
        <div className="flex items-center gap-1 font-display text-2xl text-light">
          <Image
            src="/icons/VP.webp"
            alt="VP"
            width={20}
            height={20}
            className="opacity-90"
          />
          <span>{Math.round(stats.averageDailyCost).toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
