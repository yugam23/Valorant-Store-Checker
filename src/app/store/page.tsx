"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { StoreGrid } from "@/components/store/StoreGrid";
import { WalletDisplay } from "@/components/store/WalletDisplay";
import { NightMarket } from "@/components/store/NightMarket";
import type { StoreData } from "@/types/store";

type LoadingState = "idle" | "loading" | "success" | "error";

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
    <div className="flex items-center gap-0.5">
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
  const router = useRouter();
  const [storeData, setStoreData] = useState<StoreData | null>(null);
  const [loadingState, setLoadingState] = useState<LoadingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST", credentials: "include" });
    } finally {
      router.push("/login");
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
                Daily Store
              </h1>
              {loadingState === "success" && storeData?.expiresAt && (
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 text-xs font-display uppercase tracking-wider">
                    Resets in
                  </span>
                  <CountdownTimer expiresAt={storeData.expiresAt} />
                </div>
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
            <div className="angular-card bg-void-surface/50 flex flex-col items-center justify-center py-20 space-y-4">
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
            <div className="angular-card bg-void-surface/50 flex flex-col items-center justify-center py-20 space-y-4">
              <div className="w-16 h-16 flex items-center justify-center border border-red-500/30 angular-card-sm">
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
            <div
              className="stagger-entrance"
              style={{ "--stagger-delay": "100ms" } as React.CSSProperties}
            >
              <StoreGrid items={storeData.items} />
            </div>

            {storeData.nightMarket && (
              <div
                className="stagger-entrance"
                style={{ "--stagger-delay": "200ms" } as React.CSSProperties}
              >
                <NightMarket nightMarket={storeData.nightMarket} />
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
