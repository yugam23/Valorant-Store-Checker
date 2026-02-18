import { NightMarket } from "@/components/store/NightMarket";
import { hydrateNightMarket, getStoreStaticData } from "@/lib/store-service";
import { RiotStorefront } from "@/types/riot";

interface NightMarketSectionProps {
  storefront: RiotStorefront;
  staticData: Awaited<ReturnType<typeof getStoreStaticData>>;
}

export async function NightMarketSection({ storefront, staticData }: NightMarketSectionProps) {
  const nightMarket = await hydrateNightMarket(storefront, staticData);

  if (!nightMarket) return null;

  return (
    <>
      <div className="h-[1px] bg-gradient-to-r from-valorant-red/50 via-white/10 to-transparent mb-8" />
      <NightMarket nightMarket={nightMarket} />
    </>
  );
}
