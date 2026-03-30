import { NightMarketClient } from "@/components/store/NightMarketClient";
import { checkWishlistInStore } from "@/lib/wishlist";
import { StoreTokens } from "@/lib/riot-store";
import type { StoreData } from "@/types/store";

interface NightMarketSectionProps {
  session: StoreTokens;
  storeData: StoreData;
}

export async function NightMarketSection({ session, storeData }: NightMarketSectionProps) {
  const { nightMarket } = storeData;

  if (!nightMarket) return null;

  // Check wishlist matches against night market items
  const wishlistMatches = await checkWishlistInStore(
    session.puuid,
    nightMarket.items.map((i) => i.uuid)
  );
  const wishlistedUuids = wishlistMatches
    .filter((m) => m.isInStore)
    .map((m) => m.skinUuid);

  return (
    <>
      <div className="h-[1px] bg-gradient-to-r from-valorant-red/50 via-white/10 to-transparent mb-8" />
      <NightMarketClient nightMarket={nightMarket} initialWishlistedUuids={wishlistedUuids} />
    </>
  );
}
