"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { HistoryCard } from "@/components/history/HistoryCard";
import { HistoryStats } from "@/components/history/HistoryStats";
import type { StoreRotation, HistoryStats as HistoryStatsType } from "@/types/history";
import Link from "next/link";
import { useMemo } from "react";

export default function HistoryPage() {
  // Reactively query store rotations from IndexedDB
  const rotations = useLiveQuery(
    async () => {
      if (!db) return [];
      return await db.storeRotations.orderBy('date').reverse().limit(90).toArray();
    },
    []
  );

  // Compute stats client-side from rotations array
  const stats = useMemo((): HistoryStatsType => {
    if (!rotations || rotations.length === 0) {
      return {
        totalRotationsSeen: 0,
        uniqueSkinsOffered: 0,
        mostOfferedSkin: {
          uuid: '',
          displayName: 'N/A',
          count: 0,
        },
        averageDailyCost: 0,
      };
    }

    const totalRotationsSeen = rotations.length;

    // Count unique skin UUIDs and track frequency
    const skinUuids = new Set<string>();
    const skinCounts = new Map<string, { displayName: string; count: number }>();
    let totalCost = 0;

    for (const rotation of rotations) {
      for (const item of rotation.items) {
        skinUuids.add(item.uuid);
        totalCost += item.cost;

        const existing = skinCounts.get(item.uuid);
        if (existing) {
          existing.count++;
        } else {
          skinCounts.set(item.uuid, {
            displayName: item.displayName,
            count: 1,
          });
        }
      }
    }

    const uniqueSkinsOffered = skinUuids.size;

    // Find most frequently offered skin
    let mostOfferedSkin = {
      uuid: '',
      displayName: 'N/A',
      count: 0,
    };

    for (const [uuid, data] of skinCounts.entries()) {
      if (data.count > mostOfferedSkin.count) {
        mostOfferedSkin = {
          uuid,
          displayName: data.displayName,
          count: data.count,
        };
      }
    }

    const averageDailyCost = totalCost / totalRotationsSeen;

    return {
      totalRotationsSeen,
      uniqueSkinsOffered,
      mostOfferedSkin,
      averageDailyCost,
    };
  }, [rotations]);

  // Handle db unavailable (private browsing mode)
  if (db === null) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto space-y-8">
          <h1 className="font-display text-5xl uppercase text-light mb-8">
            Store History
          </h1>

          <div className="angular-card bg-void-surface/50 p-12 text-center space-y-4">
            <p className="text-xl text-zinc-400">
              History is unavailable in private browsing mode
            </p>
            <p className="text-sm text-zinc-500">
              IndexedDB storage is required to track your store history.
              Please use a regular browsing window.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // Handle loading state
  if (rotations === undefined) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto space-y-8">
          <h1 className="font-display text-5xl uppercase text-light mb-8">
            Store History
          </h1>

          <div className="angular-card bg-void-surface/50 p-12 text-center">
            <div className="animate-pulse space-y-4">
              <div className="h-8 bg-void-deep/50 rounded w-1/3 mx-auto" />
              <div className="h-4 bg-void-deep/50 rounded w-1/2 mx-auto" />
            </div>
          </div>
        </div>
      </main>
    );
  }

  // Handle empty state
  if (rotations.length === 0) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto space-y-8">
          <h1 className="font-display text-5xl uppercase text-light mb-8">
            Store History
          </h1>

          <div className="angular-card bg-void-surface/50 p-12 text-center space-y-6">
            <p className="text-xl text-zinc-400">
              No store history yet
            </p>
            <p className="text-sm text-zinc-500">
              Visit your Store page to start tracking daily rotations.
            </p>
            <Link
              href="/store"
              className="inline-block px-6 py-3 bg-valorant-red hover:bg-valorant-red/80 text-light font-medium uppercase tracking-wide transition-colors duration-200 angular-btn"
            >
              Go to Store
            </Link>
          </div>
        </div>
      </main>
    );
  }

  // Data state - show stats and history
  return (
    <main className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
      <div className="max-w-7xl mx-auto space-y-8">
        <h1 className="font-display text-5xl uppercase text-light mb-8">
          Store History
        </h1>

        {/* Stats dashboard */}
        <HistoryStats stats={stats} />

        {/* Angular separator */}
        <div className="h-[2px] w-full bg-gradient-to-r from-transparent via-valorant-red/50 to-transparent my-8" />

        {/* History cards */}
        <div className="space-y-4">
          {rotations.map((rotation, index) => (
            <HistoryCard
              key={rotation.id || rotation.date}
              rotation={rotation}
              staggerIndex={index}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
