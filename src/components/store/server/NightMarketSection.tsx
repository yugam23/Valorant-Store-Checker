import { NightMarket } from "@/components/store/NightMarket";
import type { StoreData } from "@/types/store";

interface NightMarketSectionProps {
  storeData: StoreData;
}

export async function NightMarketSection({ storeData }: NightMarketSectionProps) {
  const { nightMarket } = storeData;

  if (!nightMarket) return null;

  return (
    <>
      <div className="h-[1px] bg-gradient-to-r from-valorant-red/50 via-white/10 to-transparent mb-8" />
      <NightMarket nightMarket={nightMarket} />
    </>
  );
}
