"use client";

import { useEffect, useState, useCallback } from "react";
import { StoreGrid } from "@/components/store/StoreGrid";
import { WalletDisplay } from "@/components/store/WalletDisplay";
import { NightMarket } from "@/components/store/NightMarket";
import { FeaturedBundle } from "@/components/store/FeaturedBundle";
import type { StoreData, StoreLoadingState } from "@/types/store";

/** Inline countdown timer with individual digit cards */
function CountdownTimer({ expiresAt }: { expiresAt: string | Date }) {
  const [timeLeft, setTimeLeft] = useState({ h: "00", m: "00", s: "00" });

  const calcTime = useCallback(() => {
    const diff = new Date(expiresAt).getTime() - Date.now();
    if (diff <= 0) return { h: "00", m: "00", s: "00" };
    const h = String(Math.floor(diff / 3600000)).padStart(2, "0");
    const m = String(Math.floor((diff % 3600000) / 60000)).padStart(2, "0");
    const s = String(Math.floor((diff % 60000) / 1000)).padStart(2, "0");
    return { h, m, s };
  }, [expiresAt]);

  useEffect(() => {
    setTimeLeft(calcTime());
    const id = setInterval(() => setTimeLeft(calcTime()), 1000);
    return () => clearInterval(id);
  }, [calcTime]);

  const DigitCard = ({ value }: { value: string }) => (
    <span className="inline-block w-10 h-12 leading-[3rem] text-center text-2xl font-mono font-bold text-light bg-void-deep angular-card-sm">
      {value}
    </span>
  );

  const Separator = () => (
    <span className="text-valorant-red text-2xl font-bold mx-0.5 animate-pulse-glow">:</span>
  );

  return (
    <div className="flex items-center gap-0.5" role="timer" aria-live="polite" aria-label={`${timeLeft.h} hours ${timeLeft.m} minutes ${timeLeft.s} seconds remaining`}>
      <DigitCard value={timeLeft.h[0]} />
      <DigitCard value={timeLeft.h[1]} />
      <Separator />
      <DigitCard value={timeLeft.m[0]} />
      <DigitCard value={timeLeft.m[1]} />
      <Separator />
      <DigitCard value={timeLeft.s[0]} />
      <DigitCard value={timeLeft.s[1]} />
    </div>
  );
}

export default function StorePage() {
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [loadingState, setLoadingState] = useState<StoreLoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);
  const [fromCache, setFromCache] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      window.location.href = "/login";
    }
  };

  useEffect(() => {
    async function fetchStore() {
      setLoadingState("loading");
      setError(null);

      try {
        const response = await fetch("/api/store", {
          method: "GET",
          credentials: "include",
        });

        if (!response.ok) {
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

        const data = await response.json();
        setFromCache(!!data.fromCache);
        setStoreData(data as StoreData);
        setLoadingState("success");
      } catch (err) {
        console.error("Store fetch error:", err);
        setError(err instanceof Error ? err.message : "Unknown error occurred");
        setLoadingState("error");
      }
    }

    fetchStore();
  }, []);

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div
          className="mb-8 stagger-entrance"
          style={{ "--stagger-delay": "0ms" } as React.CSSProperties}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="font-display text-5xl md:text-6xl uppercase font-bold text-light mb-2">
                Your Store
              </h1>
              {loadingState === "success" && storeData?.expiresAt && fromCache && (
                <span className="text-amber-500/70 text-[10px] font-display uppercase tracking-wider border border-amber-500/20 px-2 py-0.5">
                  Cached
                </span>
              )}
            </div>

            <div className="flex items-center gap-4">
              {loadingState === "success" && storeData?.wallet && (
                <WalletDisplay wallet={storeData.wallet} />
              )}
              <button
                onClick={handleLogout}
                disabled={loggingOut}
                className="angular-btn px-4 py-2 text-sm font-display uppercase tracking-wider text-zinc-400 bg-void-surface border border-white/5 hover:text-white hover:border-valorant-red/30 transition-all disabled:opacity-50"
              >
                {loggingOut ? "Logging out..." : "Logout"}
              </button>
            </div>
          </div>
        </div>

        {/* Loading state */}
        {loadingState === "loading" && (
          <div
            className="stagger-entrance"
            style={{ "--stagger-delay": "100ms" } as React.CSSProperties}
          >
            <div className="angular-card bg-void-surface/50 flex flex-col items-center justify-center py-20 space-y-4" role="status" aria-label="Loading store data">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-2 border-valorant-red/20 angular-card-sm" />
                <div className="absolute inset-0 border-t-2 border-valorant-red animate-spin" style={{ borderRadius: "50%" }} />
              </div>
              <p className="text-zinc-400 font-display uppercase tracking-wider text-sm">Loading your store...</p>
            </div>
          </div>
        )}

        {/* Error state */}
        {loadingState === "error" && (
          <div
            className="stagger-entrance"
            style={{ "--stagger-delay": "100ms" } as React.CSSProperties}
          >
            <div className="angular-card bg-void-surface/50 flex flex-col items-center justify-center py-20 space-y-4" role="alert">
              <div className="w-16 h-16 flex items-center justify-center border border-red-500/30 angular-card-sm" aria-hidden="true">
                <span className="text-3xl text-red-500">!</span>
              </div>
              <p className="text-zinc-300 text-lg font-display uppercase">Error loading store</p>
              <p className="text-zinc-500 text-sm">{error}</p>
              {error?.includes("Not authenticated") ? (
                <a
                  href="/login"
                  className="mt-4 angular-btn px-6 py-3 bg-valorant-red text-white font-display uppercase tracking-wider hover:bg-red-600 transition-colors"
                >
                  Go to Login
                </a>
              ) : (
                <button
                  onClick={() => window.location.reload()}
                  className="mt-4 angular-btn px-6 py-3 bg-void-elevated text-white font-display uppercase tracking-wider hover:bg-void-surface transition-colors"
                >
                  Retry
                </button>
              )}
            </div>
          </div>
        )}

        {/* Store content */}
        {loadingState === "success" && storeData && (
          <>
            {/* Featured Bundle */}
            {storeData.bundle && (
              <div
                className="stagger-entrance mb-12"
                style={{ "--stagger-delay": "100ms" } as React.CSSProperties}
              >
                <FeaturedBundle bundle={storeData.bundle} />
              </div>
            )}

            {/* Section separator */}
            {storeData.bundle && (
              <div className="h-[1px] bg-gradient-to-r from-valorant-red/50 via-white/10 to-transparent mb-8" />
            )}

            {/* Daily Store section */}
            <div
              className="stagger-entrance mb-8"
              style={{ "--stagger-delay": "200ms" } as React.CSSProperties}
            >
              <div className="mb-6">
                <h2 className="font-display text-3xl uppercase font-bold text-light mb-3">
                  Daily Store
                </h2>
                {storeData.expiresAt && (
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 text-xs font-display uppercase tracking-wider">
                      Resets in
                    </span>
                    <CountdownTimer expiresAt={storeData.expiresAt} />
                  </div>
                )}
              </div>
              <StoreGrid items={storeData.items} />
            </div>

            {/* Night Market */}
            {storeData.nightMarket && (
              <>
                <div className="h-[1px] bg-gradient-to-r from-valorant-red/50 via-white/10 to-transparent mb-8" />
                <div
                  className="stagger-entrance"
                  style={{ "--stagger-delay": "300ms" } as React.CSSProperties}
                >
                  <NightMarket nightMarket={storeData.nightMarket} />
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
