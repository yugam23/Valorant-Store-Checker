/**
 * Wishlist API Route
 *
 * Protected endpoint for managing per-account wishlists.
 * Supports GET (fetch), POST (add), and DELETE (remove) operations.
 *
 * Session verification ensures each account has isolated wishlist data.
 */

import { NextResponse, NextRequest } from "next/server";
import { getSession } from "@/lib/session";
import {
  getWishlist,
  addToWishlist,
  removeFromWishlist,
} from "@/lib/wishlist";
import type { WishlistItem } from "@/types/wishlist";
import { createLogger } from "@/lib/logger";

const log = createLogger("Wishlist API");

/**
 * GET /api/wishlist
 * Returns the full wishlist for the active account
 */
export async function GET() {
  try {
    // Verify session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const wishlist = await getWishlist(session.puuid);
    return NextResponse.json(wishlist);
  } catch (error) {
    log.error("GET /api/wishlist failed:", error);
    return NextResponse.json(
      { error: "Failed to fetch wishlist" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/wishlist
 * Adds an item to the wishlist
 * Body: WishlistItem
 */
export async function POST(request: NextRequest) {
  try {
    // Verify session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const item: WishlistItem = await request.json();

    // Validate required fields
    if (
      !item.skinUuid ||
      !item.displayName ||
      !item.displayIcon ||
      !item.tierColor
    ) {
      return NextResponse.json(
        { error: "Invalid wishlist item. Missing required fields." },
        { status: 400 }
      );
    }

    // Add addedAt timestamp if not present
    if (!item.addedAt) {
      item.addedAt = new Date().toISOString();
    }

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
}

/**
 * DELETE /api/wishlist
 * Removes an item from the wishlist
 * Body: { skinUuid: string }
 */
export async function DELETE(request: NextRequest) {
  try {
    // Verify session
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse request body
    const { skinUuid }: { skinUuid: string } = await request.json();

    if (!skinUuid) {
      return NextResponse.json(
        { error: "skinUuid is required" },
        { status: 400 }
      );
    }

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
}
