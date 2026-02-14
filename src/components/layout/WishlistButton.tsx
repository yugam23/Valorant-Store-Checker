"use client";

import { useState, useEffect } from "react";
import { WishlistPanel } from "../wishlist/WishlistPanel";

export function WishlistButton() {
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [wishlistCount, setWishlistCount] = useState(0);
  const [hasStoreMatches, setHasStoreMatches] = useState(false);

  useEffect(() => {
    // Fetch wishlist count on mount
    fetchWishlistCount();
  }, []);

  const fetchWishlistCount = async () => {
    try {
      const response = await fetch("/api/wishlist", {
        credentials: "include",
      });

      if (response.ok) {
        const data = await response.json();
        setWishlistCount(data.count || 0);

        // Check if any wishlisted items are in store
        // This would require store data - for now we'll skip this complexity
        // and handle it in the store page itself
      }
    } catch (err) {
      console.error("Failed to fetch wishlist count:", err);
    }
  };

  const handlePanelClose = () => {
    setIsPanelOpen(false);
  };

  const handleWishlistUpdate = () => {
    fetchWishlistCount();
  };

  return (
    <>
      <button
        onClick={() => setIsPanelOpen(true)}
        className={`relative group flex items-center gap-2 px-3 py-1.5 rounded-lg transition-all ${
          hasStoreMatches
            ? "bg-[#F0B232]/20 hover:bg-[#F0B232]/30"
            : "bg-void-surface hover:bg-void-elevated"
        }`}
        aria-label="Open wishlist"
      >
        <svg
          className={`w-5 h-5 transition-all ${
            hasStoreMatches
              ? "fill-[#F0B232] animate-pulse-glow"
              : "fill-none stroke-zinc-400 group-hover:stroke-valorant-red"
          }`}
          viewBox="0 0 24 24"
          strokeWidth="2"
        >
          <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
        </svg>

        {wishlistCount > 0 && (
          <span
            className={`absolute -top-1 -right-1 min-w-[18px] h-[18px] flex items-center justify-center px-1 rounded-full text-[10px] font-bold ${
              hasStoreMatches
                ? "bg-[#F0B232] text-void-deep"
                : "bg-valorant-red text-white"
            }`}
          >
            {wishlistCount > 99 ? "99+" : wishlistCount}
          </span>
        )}
      </button>

      <WishlistPanel
        isOpen={isPanelOpen}
        onClose={handlePanelClose}
        onWishlistUpdate={handleWishlistUpdate}
      />
    </>
  );
}
