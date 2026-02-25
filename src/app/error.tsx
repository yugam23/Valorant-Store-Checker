"use client";

import { useEffect } from "react";
import Link from "next/link";

/**
 * Root Error Boundary
 *
 * Catches any unhandled errors in the app and displays a
 * Valorant-themed fallback instead of the default Next.js error page.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[App Error Boundary]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-16">
      <div className="angular-card bg-void-surface/80 max-w-md w-full p-10 text-center space-y-6">
        {/* Error icon */}
        <div className="w-16 h-16 mx-auto flex items-center justify-center border border-red-500/30 angular-card-sm">
          <span className="text-4xl text-red-500 font-bold">!</span>
        </div>

        <h2 className="font-display text-2xl uppercase font-bold text-light tracking-wider">
          Something Went Wrong
        </h2>

        <p className="text-zinc-400 text-sm leading-relaxed">
          An unexpected error occurred. This has been logged automatically.
        </p>

        {process.env.NODE_ENV === "development" && (
          <pre className="text-left text-xs text-red-400/80 bg-void-deep p-3 overflow-auto max-h-32 angular-card-sm">
            {error.message}
          </pre>
        )}

        <div className="flex gap-3 justify-center pt-2">
          <button
            onClick={reset}
            className="angular-btn px-6 py-3 bg-valorant-red text-white font-display uppercase tracking-wider text-sm hover:bg-red-600 transition-colors"
          >
            Try Again
          </button>
          <Link
            href="/"
            className="angular-btn px-6 py-3 bg-void-elevated text-zinc-300 font-display uppercase tracking-wider text-sm hover:bg-void-surface transition-colors"
          >
            Go Home
          </Link>
        </div>
      </div>
    </div>
  );
}
