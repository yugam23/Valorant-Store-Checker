"use client";

import { useEffect, useState } from "react";
import { PlayerCardBanner } from "@/components/profile/PlayerCardBanner";
import { IdentityInfo } from "@/components/profile/IdentityInfo";
import type { ProfilePageData } from "@/types/profile";

type LoadingState = "idle" | "loading" | "success" | "error";

export default function ProfilePage() {
  const [state, setState] = useState<LoadingState>("idle");
  const [profileData, setProfileData] = useState<ProfilePageData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");

  const fetchProfile = async () => {
    setState("loading");
    setErrorMessage("");

    try {
      const response = await fetch("/api/profile");

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || "Failed to fetch profile");
      }

      const data: ProfilePageData = await response.json();
      setProfileData(data);
      setState("success");
    } catch (error) {
      console.error("Failed to fetch profile:", error);
      setErrorMessage(error instanceof Error ? error.message : "Unknown error");
      setState("error");
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

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
            <div className="w-full aspect-[21/9] bg-void-surface angular-card" />
            {/* Name skeleton */}
            <div className="space-y-2 px-1">
              <div className="h-8 w-64 bg-void-surface rounded" />
              <div className="h-4 w-48 bg-void-surface rounded" />
            </div>
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
              onClick={fetchProfile}
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
                <div className="w-full aspect-[21/9] bg-void-surface angular-card flex items-center justify-center">
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
          </div>
        )}
      </div>
    </div>
  );
}
