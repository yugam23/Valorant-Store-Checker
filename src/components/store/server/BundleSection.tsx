import { FeaturedBundle } from "@/components/store/FeaturedBundle";
import { hydrateBundle, getStoreStaticData } from "@/lib/store-service";
import { RiotStorefront } from "@/types/riot";

interface BundleSectionProps {
  storefront: RiotStorefront;
  staticData: Awaited<ReturnType<typeof getStoreStaticData>>;
}

export async function BundleSection({ storefront, staticData }: BundleSectionProps) {
  const bundle = await hydrateBundle(storefront, staticData);

  if (!bundle) return null;

  return (
    <div className="mb-12">
      <FeaturedBundle bundle={bundle} />
      <div className="h-[1px] bg-gradient-to-r from-valorant-red/50 via-white/10 to-transparent mt-8" />
    </div>
  );
}
