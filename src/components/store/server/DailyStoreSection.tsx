import { DailyStoreClient } from "@/components/store/DailyStoreClient";
import { checkWishlistInStore } from "@/lib/wishlist";
import { StoreTokens } from "@/lib/riot-store";
import { getActiveAccount } from "@/lib/accounts";
import type { StoreData } from "@/types/store";

interface DailyStoreSectionProps {
  session: StoreTokens;
  storeData: StoreData;
}

export async function DailyStoreSection({ session, storeData }: DailyStoreSectionProps) {
  const { items, expiresAt } = storeData;

  // Check wishlist matches against daily store items
  const wishlistMatches = await checkWishlistInStore(
    session.puuid,
    items.map((i) => i.uuid)
  );
  const wishlistedUuids = wishlistMatches
    .filter((m) => m.isInStore)
    .map((m) => m.skinUuid);

  // Get active account for history logging context
  const activeAccount = await getActiveAccount();

  return (
    <div className="mb-8">
      <DailyStoreClient 
        items={items} 
        initialWishlistedUuids={wishlistedUuids} 
        expiresAt={expiresAt.toISOString()}
        puuid={session.puuid}
        account={activeAccount ? { gameName: activeAccount.gameName, tagLine: activeAccount.tagLine } : undefined}
      />
    </div>
  );
}
