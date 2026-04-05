import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithRefresh } from "@/lib/session";
import { fetchUserStore } from "@/lib/store-service";
import { WalletSection } from "@/components/store/server/WalletSection";
import { DailyStoreSection } from "@/components/store/server/DailyStoreSection";
import { BundleSection } from "@/components/store/server/BundleSection";
import { NightMarketSection } from "@/components/store/server/NightMarketSection";
import { LoadingSkeleton } from "@/components/store/LoadingSkeleton";
import { LogoutButtonClient } from "@/components/store/LogoutButtonClient";
import { SectionErrorBoundary } from "@/components/store/SectionErrorBoundary";

// Store page reads session cookies — must be dynamically rendered per request.
export const dynamic = "force-dynamic";

/**
 * Store Page — async Server Component
 *
 * Data flow:
 * 1. Authenticate & get session (blocks — required for every downstream call).
 * 2. `fetchUserStore` fetches storefront + static data in parallel, then
 *    hydrates daily items, bundles, and night market in parallel.
 * 3. Wallet is fetched independently inside `<WalletSection>`, wrapped in
 *    its own Suspense boundary so it renders as soon as it resolves without
 *    blocking the main content.
 */
export default async function StorePage() {
  const session = await getSessionWithRefresh();

  if (!session) {
    redirect("/login");
  }

  // Single orchestration call — replaces manual getStorefront + getStoreStaticData
  const storeData = await fetchUserStore(session);

  if (!storeData) {
    return (
      <div className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
        <div className="max-w-7xl mx-auto text-center py-20">
          <h1 className="font-display text-4xl uppercase font-bold text-light mb-4">Store Unavailable</h1>
          <p className="text-zinc-400">Failed to load store data. Please try again later.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8 stagger-entrance">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="font-display text-5xl md:text-6xl uppercase font-bold text-light mb-2">
                Your Store
              </h1>
            </div>

            <div className="flex items-center gap-4 flex-wrap">
              <Suspense fallback={<div className="h-10 w-32 bg-white/5 rounded animate-pulse" />}>
                 <WalletSection session={session} />
              </Suspense>
              
              <LogoutButtonClient />
            </div>
          </div>
        </div>

        {/* Content — bundles, daily store, night market */}
        <SectionErrorBoundary sectionName="Featured Bundle">
          <Suspense fallback={<LoadingSkeleton text="Loading Bundle..." />}>
            <BundleSection storeData={storeData} />
          </Suspense>
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="Daily Store">
          <Suspense fallback={<LoadingSkeleton text="Loading Daily Store..." />}>
            <DailyStoreSection session={session} storeData={storeData} />
          </Suspense>
        </SectionErrorBoundary>

        <SectionErrorBoundary sectionName="Night Market">
          <Suspense fallback={<LoadingSkeleton text="Loading Night Market..." />}>
            <NightMarketSection session={session} storeData={storeData} />
          </Suspense>
        </SectionErrorBoundary>
      </div>
    </div>
  );
}
