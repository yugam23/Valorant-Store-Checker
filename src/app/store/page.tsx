/**
 * Store Page
 *
 * Main store page displaying daily offers
 * - Fetches store data from /api/store
 * - Displays StoreGrid with hydrated items
 * - Shows wallet balance
 * - Handles loading and error states
 *
 * Security: Client-side fetch uses browser cookies automatically
 */

"use client";

import { useEffect, useState } from "react";
import { StoreGrid } from "@/components/store/StoreGrid";
import { WalletDisplay } from "@/components/store/WalletDisplay";
import { NightMarket } from "@/components/store/NightMarket";
import type { StoreData } from "@/types/store";

type LoadingState = "idle" | "loading" | "success" | "error";

export default function StorePage() {
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchStore() {
      setLoadingState("loading");
      setError(null);

      try {
        const response = await fetch("/api/store", {
          method: "GET",
          credentials: "include", // Include cookies for auth
        });

        if (!response.ok) {
          // Handle specific error cases
          if (response.status === 401) {
            setError("Not authenticated. Please log in.");
            setLoadingState("error");
            return;
          }

          const errorData = await response.json().catch(() => ({}));
          setError(errorData.error || `Failed to fetch store (${response.status})`);
          setLoadingState("error");
          return;
        }

        const data: StoreData = await response.json();
        setStoreData(data);
        setLoadingState("success");
      } catch (err) {
        console.error("Store fetch error:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        setLoadingState("error");
      }
    }

    fetchStore();
  }, []);

  // Calculate time until store reset
  const getTimeRemaining = () => {
    if (!storeData?.expiresAt) return null;

    const now = new Date();
    const reset = new Date(storeData.expiresAt);
    const diff = reset.getTime() - now.getTime();

    if (diff <= 0) return "Store expired - refresh to see new items";

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

    return `Resets in ${hours}h ${minutes}m`;
  };

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl md:text-5xl font-bold text-foreground mb-2">
                Daily Store
              </h1>
              {loadingState === "success" && storeData && (
                <p className="text-zinc-400 text-sm">
                  {getTimeRemaining()}
                </p>
              )}
            </div>

            {/* Wallet display */}
            {loadingState === "success" && storeData?.wallet && (
              <WalletDisplay wallet={storeData.wallet} />
            )}
          </div>
        </div>

        {/* Content */}
        {loadingState === "loading" && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-valorant-red"></div>
            <p className="text-zinc-400">Loading your store...</p>
          </div>
        )}

        {loadingState === "error" && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="text-6xl">⚠️</div>
            <p className="text-zinc-300 text-lg font-medium">Error loading store</p>
            <p className="text-zinc-500 text-sm">{error}</p>
            {error?.includes("Not authenticated") && (
              <a
                href="/login"
                className="mt-4 px-6 py-3 bg-valorant-red text-white rounded-lg hover:bg-red-600 transition-colors"
              >
                Go to Login
              </a>
            )}
            {!error?.includes("Not authenticated") && (
              <button
                onClick={() => window.location.reload()}
                className="mt-4 px-6 py-3 bg-zinc-800 text-white rounded-lg hover:bg-zinc-700 transition-colors"
              >
                Retry
              </button>
            )}
          </div>
        )}

        {loadingState === "success" && storeData && (
          <>
            <StoreGrid items={storeData.items} />

            {/* Night Market Section */}
            {storeData.nightMarket && (
              <NightMarket nightMarket={storeData.nightMarket} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
