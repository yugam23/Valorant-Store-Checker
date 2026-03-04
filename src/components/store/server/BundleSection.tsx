import { FeaturedBundleCarousel } from "@/components/store/FeaturedBundle";
import type { StoreData } from "@/types/store";

interface BundleSectionProps {
  storeData: StoreData;
}

export async function BundleSection({ storeData }: BundleSectionProps) {
  const { bundles } = storeData;

  if (!bundles || bundles.length === 0) return null;

  return (
    <div className="mb-12">
      <FeaturedBundleCarousel bundles={bundles} />
      <div className="h-[1px] bg-gradient-to-r from-valorant-red/50 via-white/10 to-transparent mt-8" />
    </div>
  );
}
