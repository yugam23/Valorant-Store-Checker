"use client";

import { useEffect, useState, useCallback } from "react";
import { StoreGrid } from "./StoreGrid";
import type { StoreItem } from "@/types/store";
import type { WishlistData } from "@/types/wishlist";

import { logStoreRotation } from "@/lib/store-history";

interface DailyStoreClientProps {
  items: StoreItem[];
  initialWishlistedUuids: string[];
  expiresAt: string; // ISO string 
  puuid: string;
  account?: { gameName?: string; tagLine?: string };
}

/** Inline countdown timer with individual digit cards */
function CountdownTimer({ expiresAt }: { expiresAt: string | Date }) {
  const [timeLeft, setTimeLeft] = useState({ h: "00", m: "00", s: "00" });

  const calcTime = useCallback(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return { h: "00", m: "00", s: "00" };
    const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
    return { h, m, s };
  }, [expiresAt]);

  useEffect(() => {
    setTimeLeft(calcTime());
    const id = setInterval(() => setTimeLeft(calcTime()), 1000);
    return () => clearInterval(id);
  }, [calcTime]);

  const DigitCard = ({ value }: { value: string }) => (
    <span className="inline-block w-10 h-12 leading-[3rem] text-center text-2xl font-mono font-bold text-light bg-void-deep angular-card-sm">
      {value}
    </span>
  );

  const Separator = () => (
    <span className="text-valorant-red text-2xl font-bold mx-0.5 animate-pulse-glow">:</span>
  );

  return (
    <div className="flex items-center gap-0.5" role="timer" aria-live="polite" aria-label={`${timeLeft.h} hours ${timeLeft.m} minutes ${timeLeft.s} seconds remaining`}>
      <DigitCard value={timeLeft.h[0]} />
      <DigitCard value={timeLeft.h[1]} />
      <Separator />
      <DigitCard value={timeLeft.m[0]} />
      <DigitCard value={timeLeft.m[1]} />
      <Separator />
      <DigitCard value={timeLeft.s[0]} />
      <DigitCard value={timeLeft.s[1]} />
    </div>
  );
}

export function DailyStoreClient({ items, initialWishlistedUuids, expiresAt, puuid, account }: DailyStoreClientProps) {
  const [wishlistedUuids, setWishlistedUuids] = useState<string[]>(initialWishlistedUuids);

  useEffect(() => {
    if (items.length > 0 && puuid) {
      logStoreRotation(puuid, items, new Date(expiresAt), account).catch((e) => 
        console.error("Failed to log store history:", e)
      );
    }
  }, [items, puuid, expiresAt, account]);

  const handleWishlistToggle = async (skinUuid: string, item: StoreItem) => {
    const isCurrentlyWishlisted = wishlistedUuids.includes(skinUuid);
    const newWishlistState = isCurrentlyWishlisted
        ? wishlistedUuids.filter(id => id !== skinUuid)
        : [...wishlistedUuids, skinUuid];
    
    // Optimistic update
    setWishlistedUuids(newWishlistState);

    try {
      if (isCurrentlyWishlisted) {
        // Remove from wishlist
        await fetch("/api/wishlist", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ skinUuid }),
        });
      } else {
        // Add to wishlist
        const wishlistItem = {
            skinUuid: item.uuid,
            displayName: item.displayName,
            displayIcon: item.displayIcon,
            tierColor: item.tierColor,
            addedAt: new Date().toISOString(),
        };

        await fetch("/api/wishlist", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(wishlistItem),
        });
      }
    } catch (err) {
      console.error("Wishlist toggle error:", err);
      // Revert on error
      setWishlistedUuids(initialWishlistedUuids); 
    }
  };

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
            <CountdownTimer expiresAt={expiresAt} />
        </div>
      </div>
      <StoreGrid
        items={items}
        wishlistedUuids={wishlistedUuids}
        onWishlistToggle={handleWishlistToggle}
        showInStoreNotifications={true}
      />
    </>
  );
}
