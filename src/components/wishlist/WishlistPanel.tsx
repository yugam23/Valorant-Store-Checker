"use client";

import { useEffect, useState, useCallback } from "react";
import Image from "next/image";
import type { WishlistData, WishlistItem } from "@/types/wishlist";

interface WishlistPanelProps {
  isOpen: boolean;
  onClose: () => void;
  storeItemUuids?: string[]; // UUIDs of items currently in the daily store
  onWishlistUpdate?: () => void; // Callback when wishlist changes
}

export function WishlistPanel({
  isOpen,
  onClose,
  storeItemUuids = [],
  onWishlistUpdate,
}: WishlistPanelProps) {
  const [wishlist, setWishlist] = useState<WishlistData>({ items: [], count: 0 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchWishlist = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch("/api/wishlist", {
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch wishlist: ${response.status}`);
      }

      const data: WishlistData = await response.json();
      setWishlist(data);
    } catch (err) {
      console.error("Wishlist fetch error:", err);
      setError(err instanceof Error ? err.message : "Failed to load wishlist");
    } finally {
      setLoading(false);
    }
  }, []);

  const handleRemoveItem = async (skinUuid: string) => {
    try {
      const response = await fetch("/api/wishlist", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ skinUuid }),
      });

      if (!response.ok) {
        throw new Error("Failed to remove item");
      }

      const updated: WishlistData = await response.json();
      setWishlist(updated);

      // Notify parent to refresh
      if (onWishlistUpdate) {
        onWishlistUpdate();
      }
    } catch (err) {
      console.error("Remove from wishlist error:", err);
      setError(err instanceof Error ? err.message : "Failed to remove item");
    }
  };

  // Fetch wishlist when panel opens
  useEffect(() => {
    if (isOpen) {
      fetchWishlist();
    }
  }, [isOpen, fetchWishlist]);

  // Close panel on Escape key
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, onClose]);

  // Check if a skin is currently in the store
  const isInStore = (skinUuid: string) => {
    return storeItemUuids.some(
      (uuid) => uuid.toLowerCase() === skinUuid.toLowerCase()
    );
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-void-deep/80 backdrop-blur-sm z-40"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Panel */}
      <div
        className="fixed top-0 right-0 h-full w-full md:w-[480px] bg-void-deep border-l border-valorant-red/30 z-50 shadow-2xl overflow-y-auto"
        role="dialog"
        aria-labelledby="wishlist-panel-title"
        aria-modal="true"
      >
        {/* Header */}
        <div className="sticky top-0 bg-void-deep/95 backdrop-blur-md border-b border-white/10 p-6 z-10">
          <div className="flex items-center justify-between">
            <div>
              <h2
                id="wishlist-panel-title"
                className="font-display text-2xl uppercase font-bold text-light"
              >
                Your Wishlist
              </h2>
              <p className="text-zinc-400 text-sm mt-1">
                {wishlist.count} {wishlist.count === 1 ? "skin" : "skins"} tracked
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-void-surface hover:bg-valorant-red/20 transition-all"
              aria-label="Close wishlist panel"
            >
              <svg
                className="w-5 h-5 text-zinc-400"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6">
          {loading && (
            <div className="flex items-center justify-center py-20">
              <div className="relative w-12 h-12">
                <div className="absolute inset-0 border-2 border-valorant-red/20 angular-card-sm" />
                <div
                  className="absolute inset-0 border-t-2 border-valorant-red animate-spin"
                  style={{ borderRadius: "50%" }}
                />
              </div>
            </div>
          )}

          {error && (
            <div className="angular-card bg-void-surface/50 border-red-500/20 p-6 text-center">
              <p className="text-red-400">{error}</p>
            </div>
          )}

          {!loading && !error && wishlist.count === 0 && (
            <div className="angular-card bg-void-surface/50 p-8 text-center space-y-3">
              <svg
                className="w-16 h-16 mx-auto text-zinc-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                />
              </svg>
              <p className="text-zinc-300 font-display uppercase tracking-wider">
                No skins wishlisted yet
              </p>
              <p className="text-zinc-500 text-sm">
                Browse the store and heart skins you want!
              </p>
            </div>
          )}

          {!loading && !error && wishlist.count > 0 && (
            <div className="space-y-3">
              {wishlist.items.map((item) => (
                <WishlistItemCard
                  key={item.skinUuid}
                  item={item}
                  isInStore={isInStore(item.skinUuid)}
                  onRemove={handleRemoveItem}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}

interface WishlistItemCardProps {
  item: WishlistItem;
  isInStore: boolean;
  onRemove: (skinUuid: string) => void;
}

function WishlistItemCard({ item, isInStore, onRemove }: WishlistItemCardProps) {
  const [isRemoving, setIsRemoving] = useState(false);

  const handleRemove = async () => {
    setIsRemoving(true);
    await onRemove(item.skinUuid);
    // No need to reset isRemoving — component will unmount
  };

  const addedDate = new Date(item.addedAt).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

  return (
    <div
      className={`group relative angular-card bg-void-surface overflow-hidden transition-all ${
        isInStore ? "border-2 border-[#F0B232]" : "border border-white/5"
      }`}
    >
      {/* "IN STORE NOW" badge */}
      {isInStore && (
        <div className="absolute top-2 left-2 z-10 px-2 py-1 bg-[#F0B232] text-void-deep text-xs font-bold uppercase tracking-wider angular-card-sm animate-pulse-glow">
          In Store Now
        </div>
      )}

      <div className="flex items-center gap-4 p-4">
        {/* Skin image */}
        <div
          className="relative w-20 h-20 flex-shrink-0 bg-void-deep/50 overflow-hidden"
          style={{
            boxShadow: `0 0 12px ${item.tierColor}40`,
            border: `1px solid ${item.tierColor}30`,
          }}
        >
          <Image
            src={item.displayIcon}
            alt={item.displayName}
            fill
            className="object-contain p-2"
            sizes="80px"
          />
        </div>

        {/* Skin info */}
        <div className="flex-1 min-w-0">
          <h3 className="font-display text-base uppercase font-semibold text-light truncate">
            {item.displayName}
          </h3>
          <p className="text-zinc-500 text-xs mt-1">Added on {addedDate}</p>
        </div>

        {/* Remove button */}
        <button
          onClick={handleRemove}
          disabled={isRemoving}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-void-deep hover:bg-red-500/20 transition-all disabled:opacity-50"
          aria-label={`Remove ${item.displayName} from wishlist`}
        >
          <svg
            className="w-4 h-4 text-zinc-400 group-hover:text-red-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>
      </div>

      {/* Tier color accent line */}
      <div
        className="h-[2px] w-full"
        style={{ backgroundColor: item.tierColor }}
      />
    </div>
  );
}
