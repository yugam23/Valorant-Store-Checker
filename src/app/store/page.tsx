import { Suspense } from "react";
import { redirect } from "next/navigation";
import { getSessionWithRefresh } from "@/lib/session";
import { getStorefront, getWallet, getStoreStaticData } from "@/lib/store-service";
import { WalletSection } from "@/components/store/server/WalletSection";
import { DailyStoreSection } from "@/components/store/server/DailyStoreSection";
import { BundleSection } from "@/components/store/server/BundleSection";
import { NightMarketSection } from "@/components/store/server/NightMarketSection";
import { LoadingSkeleton } from "@/components/store/LoadingSkeleton";


// Inline Logout Button for now since it needs client interactivity
import { LogoutButtonClient } from "@/components/store/LogoutButtonClient"; 

export const dynamic = 'force-dynamic';

export default async function StorePage() {
  const session = await getSessionWithRefresh();
  
  if (!session) {
    redirect("/login");
  }

  // Parallel data fetching
  // We start the promises here
  const staticDataPromise = getStoreStaticData();
  const storefrontPromise = getStorefront(session);
  const walletPromise = getWallet(session);

  // We await storefront here because it's the base for everything?
  // Actually, if we pass promises, the components need to be written to accept promises.
  // But my current SCs accept *data*.
  // So I must await *here* if I want to block the whole page? 
  // OR I should have written the components to accept promises to use Suspense *inside* them?
  // Current plan: Use Suspense boundaries for *each section*.
  // So `DailyStoreSection` should be async and I call it like `<DailyStoreSection ... />`.
  // Next.js handles async components automatically in Suspense.
  // BUT to achieve parallelism, I need to pass the *Promise* to the component, 
  // or the component must call the fetch function itself?
  // If the component calls the fetch function, it can run in parallel *if* the parent doesn't block.
  // But `getStorefront` requires `session` which is available.
  
  // Best pattern for Next 13+:
  // Pass the promise to the component? No, simply rendering async components in parallel (siblings) *is* parallel?
  // Yes, if I don't await them in the parent.
  // But I need to pass `storefront` to multiple components.
  // If I call `await getStorefront()` here, I block *everything* until storefront is ready.
  // Then I pass distinct data parts to children.
  // This means the whole page waits for `getStorefront`.
  // Is `getStorefront` slow? It hits Riot API. Yes, it can be slow.
  // But without storefront, I can't show Bundle or Daily or Night Market.
  // So likely, blocking on `storefront` is acceptable for the main content.
  // What about `wallet`? It's a separate endpoint.
  // I can wrap Wallet in Suspense if I pass the *promise* or fetched data?
  // If I await `storefront` here, `wallet` can be fetched in parallel?
  // 
  // Optimisation:
  // const storefrontPromise = getStorefront(session);
  // const walletPromise = getWallet(session);
  // const staticDataPromise = getStoreStaticData();
  //
  // const [storefront, staticData] = await Promise.all([storefrontPromise, staticDataPromise]);
  // 
  // <Suspense fallback={<Skeleton />}><WalletSection session={session} /></Suspense>
  // <DailyStore... />
  //
  // Wait, `WalletSection` (my impl) calls `getWallet` inside it. So it fetches independently. 
  // So if I render `<WalletSection session={session} />` it will fetch wallet.
  // And `DailyStoreSection` takes `storefront` (already fetched).
  //
  // So:
  // 1. Initiate static data fetch (fast/cached).
  // 2. Initiate storefront fetch.
  // 3. Initiate wallet (inside WalletSection).
  // 
  // So `StorePage` awaits `storefront`. Wallet executes in parallel inside its Suspense boundary.
  
  const [storefront, staticData] = await Promise.all([storefrontPromise, staticDataPromise]);

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

            <div className="flex items-center gap-4">
              <Suspense fallback={<div className="h-10 w-32 bg-white/5 rounded animate-pulse" />}>
                 <WalletSection session={session} />
              </Suspense>
              
              <LogoutButtonClient />
            </div>
          </div>
        </div>

        {/* Content */}
        <Suspense fallback={<LoadingSkeleton text="Loading Bundle..." />}>
             <BundleSection storefront={storefront} staticData={staticData} />
        </Suspense>

        <Suspense fallback={<LoadingSkeleton text="Loading Daily Store..." />}>
             <DailyStoreSection session={session} storefront={storefront} staticData={staticData} />
        </Suspense>

        <Suspense fallback={<LoadingSkeleton text="Loading Night Market..." />}>
             <NightMarketSection storefront={storefront} staticData={staticData} />
        </Suspense>
      </div>
    </div>
  );
}
