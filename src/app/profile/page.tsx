"use client";

import { useEffect, useState, useRef } from "react";
import { PlayerCardBanner } from "@/components/profile/PlayerCardBanner";
import { IdentityInfo } from "@/components/profile/IdentityInfo";
import { AccountLevelBadge } from "@/components/profile/AccountLevelBadge";
import { RankDisplay } from "@/components/profile/RankDisplay";
import { RRProgressBar } from "@/components/profile/RRProgressBar";
import { AlertCircle, Clock } from "lucide-react";
import type { ProfilePageData } from "@/types/profile";

function formatCachedAt(cachedAt: number): string {
  const date = new Date(cachedAt);
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

type LoadingState = "idle" | "loading" | "success" | "error";

// Module-level profile cache (SWR-style) — survives across page navigations
// Keyed by nothing since there's only one profile per session
const CACHE_TTL_MS = 60_000; // 60 seconds
let _cachedProfile: ProfilePageData | null = null;
let _cachedAt = 0;

export default function ProfilePage() {
  const [state, setState] = useState<LoadingState>("idle");
  const [profileData, setProfileData] = useState<ProfilePageData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  // Track whether this component is still mounted to avoid state updates after unmount
  const mountedRef = useRef(true);
  // Capture the initial state at mount — used for SWR cache-first decision
  const initialStateRef = useRef<LoadingState>(state);

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function loadProfile() {
      const now = Date.now();
      const isCacheStale = !_cachedProfile || (now - _cachedAt) > CACHE_TTL_MS;

      // Serve stale cache immediately while revalidating in background (SWR pattern)
      if (_cachedProfile && initialStateRef.current === "idle") {
        setProfileData(_cachedProfile);
        setState("success");
      }

      // Always fetch fresh data in background if cache is stale
      if (isCacheStale) {
        try {
          const response = await fetch("/api/profile");
          if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || "Failed to fetch profile");
          }
          const data: ProfilePageData = await response.json();
          _cachedProfile = data;
          _cachedAt = Date.now();
          if (!cancelled && mountedRef.current) {
            setProfileData(data);
            setState("success");
          }
        } catch (error) {
          console.error("Failed to fetch profile:", error);
          if (!cancelled && mountedRef.current) {
            // Only show error if we have no cached data to fall back on
            if (!_cachedProfile) {
              setErrorMessage(error instanceof Error ? error.message : "Unknown error");
              setState("error");
            }
          }
        }
      } else if (initialStateRef.current === "idle") {
        // Cache is fresh — ensure we show success state
        setState("success");
      }
    }

    loadProfile();
    return () => { cancelled = true; };
  }, []);

  const retryFetch = () => {
    _cachedProfile = null; // Invalidate cache
    _cachedAt = 0;
    setState("idle");
    setErrorMessage("");
  };

  return (
    <div className="min-h-screen bg-void p-6 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Page Header */}
        <h1 className="font-display text-2xl uppercase tracking-wider text-white mb-6">
          Player Profile
        </h1>

        {/* Loading State */}
        {state === "loading" && (
          <div className="space-y-4 animate-pulse">
            {/* Banner skeleton */}
            <div className="w-full max-w-[452px] h-[128px] bg-void-surface angular-card" />
            {/* Name skeleton */}
            <div className="space-y-2 px-1">
              <div className="h-8 w-64 bg-void-surface rounded" />
              <div className="h-4 w-48 bg-void-surface rounded" />
            </div>
            {/* Level skeleton */}
            <div className="h-16 w-32 bg-void-surface rounded" />
            {/* Rank skeleton */}
            <div className="flex gap-4">
              <div className="h-20 flex-1 bg-void-surface rounded" />
              <div className="h-20 flex-1 bg-void-surface rounded" />
            </div>
            {/* Progress bar skeleton */}
            <div className="h-6 w-full bg-void-surface rounded" />
          </div>
        )}

        {/* Error State */}
        {state === "error" && (
          <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <div className="text-valorant-red">
              <svg
                className="h-16 w-16"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
            </div>
            <p className="text-zinc-400 text-center max-w-md">
              {errorMessage || "Failed to load profile"}
            </p>
            <button
              onClick={retryFetch}
              className="px-6 py-3 bg-valorant-red hover:bg-valorant-red/90 text-white font-semibold uppercase tracking-wide angular-card transition-all"
            >
              Retry
            </button>
          </div>
        )}

        {/* Success State */}
        {state === "success" && profileData && (
          <div className="space-y-4">
            {/* Partial data warning */}
            {profileData.partial && (
              <div className="inline-block">
                <span className="text-amber-500/70 text-[10px] font-display uppercase tracking-wider border border-amber-500/20 px-2 py-0.5">
                  Some data unavailable
                </span>
              </div>
            )}

            {/* From cache indicator */}
            {profileData.fromCache && !profileData.partial && (
              <div className="inline-block">
                <span className="text-amber-500/70 text-[10px] font-display uppercase tracking-wider border border-amber-500/20 px-2 py-0.5">
                  Cached
                </span>
              </div>
            )}

            {/* Section 0: Player Card Banner */}
            <div
              className="stagger-entrance"
              style={{ "--stagger-delay": "0ms" } as React.CSSProperties}
            >
              {profileData.playerCardWideArt ? (
                <PlayerCardBanner
                  wideArt={profileData.playerCardWideArt}
                  displayName={profileData.gameName ?? "Player"}
                />
              ) : (
                <div className="w-full max-w-[452px] h-[128px] bg-void-surface angular-card flex items-center justify-center">
                  <span className="text-zinc-600 font-display uppercase tracking-wider">
                    No Player Card
                  </span>
                </div>
              )}
            </div>

            {/* Section 1: Identity Info */}
            <div
              className="stagger-entrance px-1"
              style={{ "--stagger-delay": "100ms" } as React.CSSProperties}
            >
              <IdentityInfo
                gameName={profileData.gameName}
                tagLine={profileData.tagLine}
                titleText={profileData.playerTitleText}
                country={profileData.country}
                region={profileData.region}
              />
            </div>

            {/* Section 2: Account Level */}
            <div
              className="stagger-entrance px-1"
              style={{ "--stagger-delay": "200ms" } as React.CSSProperties}
            >
              <AccountLevelBadge
                accountLevel={profileData.accountLevel}
                henrikAccountLevel={profileData.henrikAccountLevel}
                hideAccountLevel={profileData.hideAccountLevel}
              />
            </div>

            {/* Section 3: Competitive Rank */}
            <div
              className="stagger-entrance px-1"
              style={{ "--stagger-delay": "300ms" } as React.CSSProperties}
            >
              <RankDisplay
                competitiveTierName={profileData.competitiveTierName}
                competitiveTierIcon={profileData.competitiveTierIcon}
                peakTierName={profileData.peakTierName}
                henrikFailed={profileData.henrikFailed}
              />
            </div>

            {/* Henrik API failure notice */}
            {profileData.henrikFailed && (
              <div className="flex items-center gap-2 text-amber-500/70 text-xs">
                <AlertCircle className="w-4 h-4" />
                <span>Rank data temporarily unavailable</span>
              </div>
            )}

            {/* Section 4: RR Progress Bar */}
            <div
              className="stagger-entrance px-1"
              style={{ "--stagger-delay": "400ms" } as React.CSSProperties}
            >
              <RRProgressBar rankingInTier={profileData.rankingInTier} />
            </div>

            {/* Last updated timestamp — shown when data is from cache */}
            {profileData.fromCache && profileData.cachedAt && (
              <div className="flex items-center gap-2 text-zinc-500 text-[10px] font-display uppercase tracking-wider px-1">
                <Clock className="w-3 h-3" />
                <span>Showing cached data from {formatCachedAt(profileData.cachedAt)}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
