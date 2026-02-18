import { DailyStoreClient } from "@/components/store/DailyStoreClient";
import { hydrateDailyItems, getStoreStaticData } from "@/lib/store-service";
import { checkWishlistInStore } from "@/lib/wishlist";
import { RiotStorefront } from "@/types/riot";
import { StoreTokens } from "@/lib/riot-store";
import { getActiveAccount } from "@/lib/accounts";

interface DailyStoreSectionProps {
  session: StoreTokens;
  storefront: RiotStorefront;
  staticData: Awaited<ReturnType<typeof getStoreStaticData>>;
}

export async function DailyStoreSection({ session, storefront, staticData }: DailyStoreSectionProps) {
  // Hydrate items
  const items = await hydrateDailyItems(storefront, staticData);
  
  // Check wishlist
  const wishlistMatches = await checkWishlistInStore(
    session.puuid,
    items.map((i) => i.uuid)
  );
  const wishlistedUuids = wishlistMatches
    .filter((m) => m.isInStore)
    .map((m) => m.skinUuid);

  // Log history (fire and forget pattern not suitable for SC, so we await or ignore)
  // In SC, we should probably just fire it.
  // Get active account for history logging context
  const activeAccount = await getActiveAccount();

  const expiresAt = new Date(Date.now() + storefront.SkinsPanelLayout.SingleItemOffersRemainingDurationInSeconds * 1000).toISOString();

  return (
    <div className="mb-8">
      <DailyStoreClient 
        items={items} 
        initialWishlistedUuids={wishlistedUuids} 
        expiresAt={expiresAt}
        puuid={session.puuid}
        account={activeAccount ? { gameName: activeAccount.gameName, tagLine: activeAccount.tagLine } : undefined}
      />
    </div>
  );
}
