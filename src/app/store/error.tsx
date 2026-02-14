"use client";

import { useEffect } from "react";

/**
 * Store Page Error Boundary
 *
 * Catches errors specifically in the /store route and provides
 * a contextual recovery UI (retry store load or go to login).
 */
export default function StoreError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[Store Error Boundary]", error);
  }, [error]);

  const isAuthError =
    error.message?.toLowerCase().includes("unauthorized") ||
    error.message?.toLowerCase().includes("session") ||
    error.message?.toLowerCase().includes("401");

  return (
    <div className="min-h-screen px-4 py-8 md:px-8 lg:px-16">
      <div className="max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="font-display text-5xl md:text-6xl uppercase font-bold text-light mb-2">
            Your Store
          </h1>
        </div>

        <div className="angular-card bg-void-surface/50 flex flex-col items-center justify-center py-20 space-y-6">
          {/* Error icon */}
          <div className="w-16 h-16 flex items-center justify-center border border-red-500/30 angular-card-sm">
            <span className="text-3xl text-red-500 font-bold">!</span>
          </div>

          <h2 className="text-zinc-300 text-xl font-display uppercase tracking-wider">
            {isAuthError ? "Session Expired" : "Store Unavailable"}
          </h2>

          <p className="text-zinc-500 text-sm max-w-sm text-center leading-relaxed">
            {isAuthError
              ? "Your session has expired. Please log in again to view your store."
              : "We couldn't load your store right now. Please try again."}
          </p>

          {process.env.NODE_ENV === "development" && (
            <pre className="text-left text-xs text-red-400/80 bg-void-deep p-3 overflow-auto max-h-24 max-w-lg w-full angular-card-sm">
              {error.message}
            </pre>
          )}

          <div className="flex gap-3 pt-2">
            {isAuthError ? (
              <a
                href="/login"
                className="angular-btn px-6 py-3 bg-valorant-red text-white font-display uppercase tracking-wider text-sm hover:bg-red-600 transition-colors"
              >
                Go to Login
              </a>
            ) : (
              <button
                onClick={reset}
                className="angular-btn px-6 py-3 bg-valorant-red text-white font-display uppercase tracking-wider text-sm hover:bg-red-600 transition-colors"
              >
                Retry
              </button>
            )}
            <a
              href="/"
              className="angular-btn px-6 py-3 bg-void-elevated text-zinc-300 font-display uppercase tracking-wider text-sm hover:bg-void-surface transition-colors"
            >
              Go Home
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
