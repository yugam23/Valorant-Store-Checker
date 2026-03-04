"use client";

import { useState, useCallback } from "react";
import type { StoreItem } from "@/types/store";

/**
 * Custom hook for optimistic wishlist management.
 *
 * Encapsulates the add/remove toggle with optimistic UI updates and
 * automatic rollback on API failure. Keeps the wishlist state separate
 * from any specific component, making it composable.
 *
 * @param initialUuids - Skin UUIDs currently on the user's wishlist
 */
export function useWishlist(initialUuids: string[]) {
  const [wishlistedUuids, setWishlistedUuids] = useState<string[]>(initialUuids);

  const isWishlisted = useCallback(
    (uuid: string) =>
      wishlistedUuids.some(
        (id) => id.toLowerCase() === uuid.toLowerCase(),
      ),
    [wishlistedUuids],
  );

  const toggleWishlist = useCallback(
    async (skinUuid: string, item: StoreItem) => {
      const wasWishlisted = wishlistedUuids.includes(skinUuid);

      // Optimistic update
      setWishlistedUuids((prev) =>
        wasWishlisted ? prev.filter((id) => id !== skinUuid) : [...prev, skinUuid],
      );

      try {
        if (wasWishlisted) {
          await fetch("/api/wishlist", {
            method: "DELETE",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({ skinUuid }),
          });
        } else {
          await fetch("/api/wishlist", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "include",
            body: JSON.stringify({
              skinUuid: item.uuid,
              displayName: item.displayName,
              displayIcon: item.displayIcon,
              tierColor: item.tierColor,
              addedAt: new Date().toISOString(),
            }),
          });
        }
      } catch (err) {
        console.error("Wishlist toggle error:", err);
        // Rollback on failure
        setWishlistedUuids(initialUuids);
      }
    },
    [wishlistedUuids, initialUuids],
  );

  return { wishlistedUuids, isWishlisted, toggleWishlist };
}
