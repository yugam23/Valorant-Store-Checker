"use client";

import { useEffect } from "react";
import { StoreGrid } from "./StoreGrid";
import type { StoreItem } from "@/types/store";
import { logStoreRotation } from "@/lib/store-history";
import { useWishlist } from "@/hooks/useWishlist";
import { useCountdown } from "@/hooks/useCountdown";

interface DailyStoreClientProps {
  items: StoreItem[];
  initialWishlistedUuids: string[];
  expiresAt: string; // ISO string 
  puuid: string;
  account?: { gameName?: string; tagLine?: string };
}

function DigitCard({ value }: { value: string }) {
  return (
    <span className="inline-block w-10 h-12 leading-[3rem] text-center text-2xl font-mono font-bold text-light bg-void-deep angular-card-sm">
      {value}
    </span>
  );
}

function Separator() {
  return <span className="text-valorant-red text-2xl font-bold mx-0.5 animate-pulse-glow">:</span>;
}

export function DailyStoreClient({ items, initialWishlistedUuids, expiresAt, puuid, account }: DailyStoreClientProps) {
  const { wishlistedUuids, toggleWishlist } = useWishlist(initialWishlistedUuids);
  const timeLeft = useCountdown(expiresAt);

  // Display as digit pairs: h[0]h[1]:m[0]m[1]:s[0]s[1]
  const h = String(timeLeft.hours).padStart(2, "0");
  const m = String(timeLeft.minutes).padStart(2, "0");
  const s = String(timeLeft.seconds).padStart(2, "0");

  useEffect(() => {
    if (items.length > 0 && puuid) {
      logStoreRotation(puuid, items, new Date(expiresAt), account).catch((e) =>
        console.error("Failed to log store history:", e)
      );
    }
  }, [items, puuid, expiresAt, account]);

  return (
    <>
      <div className="mb-6">
        <h2 className="font-display text-3xl uppercase font-bold text-light mb-3">
            Daily Store
        </h2>
        <div className="flex items-center gap-3">
            <span className="text-zinc-500 text-xs font-display uppercase tracking-wider">
                Resets in
            </span>
            <div className="flex items-center gap-0.5" role="timer" aria-live="polite" aria-label={`${h}:${m}:${s} remaining`}>
              <DigitCard value={h[0] ?? "0"} />
              <DigitCard value={h[1] ?? "0"} />
              <Separator />
              <DigitCard value={m[0] ?? "0"} />
              <DigitCard value={m[1] ?? "0"} />
              <Separator />
              <DigitCard value={s[0] ?? "0"} />
              <DigitCard value={s[1] ?? "0"} />
            </div>
        </div>
      </div>
      <StoreGrid
        items={items}
        wishlistedUuids={wishlistedUuids}
        onWishlistToggle={toggleWishlist}
        showInStoreNotifications={true}
      />
    </>
  );
}
