"use client";

import { NightMarket } from "@/components/store/NightMarket";
import { useWishlist } from "@/hooks/useWishlist";
import type { NightMarketData, NightMarketItem, StoreItem } from "@/types/store";

interface NightMarketClientProps {
  nightMarket: NightMarketData;
  initialWishlistedUuids: string[];
}

export function NightMarketClient({ nightMarket, initialWishlistedUuids }: NightMarketClientProps) {
  const { wishlistedUuids, toggleWishlist } = useWishlist(initialWishlistedUuids);

  const handleToggle = async (skinUuid: string, item: NightMarketItem) => {
    await toggleWishlist(skinUuid, item as unknown as StoreItem);
  };

  return (
    <NightMarket
      nightMarket={nightMarket}
      wishlistedUuids={wishlistedUuids}
      onWishlistToggle={handleToggle}
    />
  );
}
