"use client";

import { useLiveQuery } from "dexie-react-hooks";
import { db } from "@/lib/db";
import { HistoryCard } from "@/components/history/HistoryCard";
import { HistoryStats } from "@/components/history/HistoryStats";
import { deleteRotation } from "@/lib/store-history";
import type { StoreRotation, HistoryStats as HistoryStatsType } from "@/types/history";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";
import { ChevronDown, User } from "lucide-react";

// Compute stats for a given set of rotations
function computeStats(rotations: StoreRotation[]): HistoryStatsType {
  if (rotations.length === 0) {
    return {
      totalRotationsSeen: 0,
      uniqueSkinsOffered: 0,
      mostOfferedSkin: { uuid: "", displayName: "N/A", count: 0 },
      averageDailyCost: 0,
    };
  }

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
        skinCounts.set(item.uuid, { displayName: item.displayName, count: 1 });
      }
    }
  }

  let mostOfferedSkin = { uuid: "", displayName: "N/A", count: 0 };
  for (const [uuid, data] of skinCounts.entries()) {
    if (data.count > mostOfferedSkin.count) {
      mostOfferedSkin = { uuid, displayName: data.displayName, count: data.count };
    }
  }

  return {
    totalRotationsSeen: rotations.length,
    uniqueSkinsOffered: skinUuids.size,
    mostOfferedSkin,
    averageDailyCost: totalCost / rotations.length,
  };
}

interface AccountGroup {
  puuid: string;
  displayName: string; // "GameName#Tag" or truncated puuid
  rotations: StoreRotation[];
  stats: HistoryStatsType;
}

// ─── Per-Account Section ──────────────────────────────────────────────────────

interface AccountSectionProps {
  group: AccountGroup;
  onDelete: (id: number) => void;
  defaultExpanded?: boolean;
}

function AccountSection({ group, onDelete, defaultExpanded = true }: AccountSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="angular-card bg-void-surface/40 overflow-hidden">
      {/* Section header — click to toggle */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center justify-between px-6 py-5 hover:bg-void-surface/60 transition-colors duration-200 group"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-3">
          {/* Avatar icon */}
          <div className="w-9 h-9 rounded-full bg-valorant-red/15 border border-valorant-red/30 flex items-center justify-center flex-shrink-0">
            <User size={16} className="text-valorant-red" />
          </div>

          <div className="text-left">
            <p className="font-display text-xl uppercase text-light tracking-wide">
              {group.displayName}
            </p>
            <p className="text-xs text-zinc-500 mt-0.5">
              {group.rotations.length} rotation{group.rotations.length !== 1 ? "s" : ""} recorded
            </p>
          </div>
        </div>

        <ChevronDown
          size={18}
          className={`text-zinc-500 transition-transform duration-300 ${
            expanded ? "rotate-180" : ""
          }`}
        />
      </button>

      {/* Collapsible body */}
      {expanded && (
        <div className="px-6 pb-6 space-y-5 border-t border-white/5">
          {/* Per-account stats */}
          <div className="pt-5">
            <HistoryStats stats={group.stats} />
          </div>

          {/* Angular separator */}
          <div className="h-[1px] w-full bg-gradient-to-r from-transparent via-white/10 to-transparent" />

          {/* History cards */}
          <div className="space-y-4">
            {group.rotations.map((rotation, index) => (
              <HistoryCard
                key={rotation.id ?? rotation.date}
                rotation={rotation}
                staggerIndex={index}
                onDelete={onDelete}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function HistoryPage() {
  // Reactively query all store rotations
  const rotations = useLiveQuery(async () => {
    if (!db) return [];
    return await db.storeRotations.orderBy("date").reverse().limit(365).toArray();
  }, []);

  // Group rotations by puuid and compute per-account stats
  const accountGroups = useMemo((): AccountGroup[] => {
    if (!rotations || rotations.length === 0) return [];

    const map = new Map<string, StoreRotation[]>();
    for (const rotation of rotations) {
      const group = map.get(rotation.puuid) ?? [];
      group.push(rotation);
      map.set(rotation.puuid, group);
    }

    return Array.from(map.entries()).map(([puuid, rots]) => {
      const first = rots[0];
      const displayName = first.gameName
        ? `${first.gameName}${first.tagLine ? `#${first.tagLine}` : ""}`
        : `${puuid.slice(0, 8)}…`;

      return {
        puuid,
        displayName,
        rotations: rots, // already newest-first from the query
        stats: computeStats(rots),
      };
    });
  }, [rotations]);

  const handleDelete = useCallback(async (id: number) => {
    await deleteRotation(id);
  }, []);

  // ── Private browsing ──────────────────────────────────────────────────────
  if (db === null) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto space-y-8">
          <h1 className="font-display text-5xl uppercase text-light mb-8">Store History</h1>
          <div className="angular-card bg-void-surface/50 p-12 text-center space-y-4">
            <p className="text-xl text-zinc-400">History is unavailable in private browsing mode</p>
            <p className="text-sm text-zinc-500">
              IndexedDB storage is required to track your store history. Please use a regular
              browsing window.
            </p>
          </div>
        </div>
      </main>
    );
  }

  // ── Loading ───────────────────────────────────────────────────────────────
  if (rotations === undefined) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto space-y-8">
          <h1 className="font-display text-5xl uppercase text-light mb-8">Store History</h1>
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

  // ── Empty ─────────────────────────────────────────────────────────────────
  if (rotations.length === 0) {
    return (
      <main className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto space-y-8">
          <h1 className="font-display text-5xl uppercase text-light mb-8">Store History</h1>
          <div className="angular-card bg-void-surface/50 p-12 text-center space-y-6">
            <p className="text-xl text-zinc-400">No store history yet</p>
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

  // ── Data ──────────────────────────────────────────────────────────────────
  return (
    <main className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
      <div className="max-w-7xl mx-auto space-y-8">
        {/* Page title + account count badge */}
        <div className="flex items-end gap-4 mb-8">
          <h1 className="font-display text-5xl uppercase text-light">Store History</h1>
          {accountGroups.length > 1 && (
            <span className="mb-1.5 px-2.5 py-0.5 text-xs font-medium uppercase tracking-wider bg-valorant-red/15 text-valorant-red border border-valorant-red/30 rounded">
              {accountGroups.length} accounts
            </span>
          )}
        </div>

        {/* One section per account */}
        <div className="space-y-6">
          {accountGroups.map((group, i) => (
            <AccountSection
              key={group.puuid}
              group={group}
              onDelete={handleDelete}
              defaultExpanded={i === 0}
            />
          ))}
        </div>
      </div>
    </main>
  );
}
