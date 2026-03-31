"use client";

import { useMemo } from "react";
import { NightMarket } from "@/components/store/NightMarket";
import { useWishlist } from "@/hooks/useWishlist";
import type { NightMarketData, NightMarketItem, StoreItem } from "@/types/store";

interface NightMarketClientProps {
  nightMarket: NightMarketData;
  initialWishlistedUuids: string[];
}

export function NightMarketClient({ nightMarket, initialWishlistedUuids }: NightMarketClientProps) {
  const { wishlistedUuids, toggleWishlist } = useWishlist(initialWishlistedUuids);

  // Convert to Set for O(1) lookup in NightMarket
  const wishlistSet = useMemo(
    () => new Set(wishlistedUuids.map(id => id.toLowerCase())),
    [wishlistedUuids]
  );

  const handleToggle = async (skinUuid: string, item: NightMarketItem) => {
    await toggleWishlist(skinUuid, item as unknown as StoreItem);
  };

  return (
    <NightMarket
      nightMarket={nightMarket}
      wishlistSet={wishlistSet}
      onWishlistToggle={handleToggle}
    />
  );
}
