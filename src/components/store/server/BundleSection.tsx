import { FeaturedBundleCarousel } from "@/components/store/FeaturedBundle";
import { hydrateBundles, getStoreStaticData } from "@/lib/store-service";
import { RiotStorefront } from "@/types/riot";

interface BundleSectionProps {
  storefront: RiotStorefront;
  staticData: Awaited<ReturnType<typeof getStoreStaticData>>;
}

export async function BundleSection({ storefront, staticData }: BundleSectionProps) {
  const bundles = await hydrateBundles(storefront, staticData);

  if (bundles.length === 0) return null;

  return (
    <div className="mb-12">
      <FeaturedBundleCarousel bundles={bundles} />
      <div className="h-[1px] bg-gradient-to-r from-valorant-red/50 via-white/10 to-transparent mt-8" />
    </div>
  );
}
