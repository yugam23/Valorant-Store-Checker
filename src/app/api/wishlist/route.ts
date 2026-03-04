/**
 * Wishlist API Route
 *
 * Protected endpoint for managing per-account wishlists.
 * Supports GET (fetch), POST (add), and DELETE (remove) operations.
 *
 * Session verification ensures each account has isolated wishlist data.
 */

import { NextResponse, NextRequest } from "next/server";
import { z } from "zod";
import { withSession, parseBody } from "@/lib/api-validate";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "@/lib/wishlist";
import { createLogger } from "@/lib/logger";

const log = createLogger("Wishlist API");

const WishlistItemSchema = z.object({
  skinUuid: z.string(),
  displayName: z.string(),
  displayIcon: z.string(),
  tierColor: z.string(),
  cost: z.number().optional(),
  addedAt: z.string().optional(),
});

const WishlistDeleteSchema = z.object({
  skinUuid: z.string(),
});

/**
 * GET /api/wishlist
 * Returns the full wishlist for the active account
 */
export const GET = withSession(async (_request, session) => {
  try {
    const wishlist = await getWishlist(session.puuid);
    return NextResponse.json(wishlist);
  } catch (error) {
    log.error("GET /api/wishlist failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch wishlist" },
      { status: 500 }
    );
  }
});

/**
 * POST /api/wishlist
 * Adds an item to the wishlist
 * Body: WishlistItem
 */
export const POST = withSession(async (request, session) => {
  try {
    const parsed = await parseBody(request, WishlistItemSchema);
    if (!parsed.success) return parsed.response;

    // Add addedAt timestamp if not present
    const item = { ...parsed.data, addedAt: parsed.data.addedAt ?? new Date().toISOString() };

    // Add to wishlist
    const updated = await addToWishlist(session.puuid, item);
    log.info(
      `Added skin ${item.displayName} to wishlist for PUUID ${session.puuid.substring(0, 8)}`
    );

    return NextResponse.json(updated);
  } catch (error) {
    log.error("POST /api/wishlist failed:", error);

    // Handle wishlist full error
    if (
      error instanceof Error &&
      error.message.includes("Wishlist full")
    ) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json(
      { error: "Failed to add item to wishlist" },
      { status: 500 }
    );
  }
});

/**
 * DELETE /api/wishlist
 * Removes an item from the wishlist
 * Body: { skinUuid: string }
 */
export const DELETE = withSession(async (request, session) => {
  try {
    const parsed = await parseBody(request, WishlistDeleteSchema);
    if (!parsed.success) return parsed.response;

    const { skinUuid } = parsed.data;

    // Remove from wishlist
    const updated = await removeFromWishlist(session.puuid, skinUuid);
    log.info(
      `Removed skin ${skinUuid} from wishlist for PUUID ${session.puuid.substring(0, 8)}`
    );

    return NextResponse.json(updated);
  } catch (error) {
    log.error("DELETE /api/wishlist failed:", error);
    return NextResponse.json(
      { error: "Failed to remove item from wishlist" },
      { status: 500 }
    );
  }
});
