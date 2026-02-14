/**
 * Accounts Management API Route
 *
 * Endpoints:
 * - GET /api/accounts - List all stored accounts
 * - DELETE /api/accounts?puuid=xxx - Remove a specific account
 *
 * Security:
 * - Uses account registry from cookies
 * - Automatically handles account switching when removing active account
 */

import { NextRequest, NextResponse } from "next/server";
import { getAccounts, removeAccount } from "@/lib/accounts";
import { createLogger } from "@/lib/logger";

const log = createLogger("Accounts API");

/**
 * GET /api/accounts
 * Returns list of stored accounts and which one is active
 */
export async function GET() {
  try {
    const registry = await getAccounts();

    if (!registry) {
      return NextResponse.json({
        accounts: [],
      });
    }

    // Transform to include isActive flag
    const accounts = registry.accounts.map((account) => ({
      puuid: account.puuid,
      region: account.region,
      gameName: account.gameName,
      tagLine: account.tagLine,
      isActive: account.puuid === registry.activePuuid,
      addedAt: account.addedAt,
    }));

    return NextResponse.json({
      accounts,
    });
  } catch (error) {
    log.error("Failed to get accounts:", error);
    return NextResponse.json(
      { error: "Failed to retrieve accounts" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/accounts?puuid=xxx
 * Removes a specific account by PUUID
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const puuid = searchParams.get("puuid");

    if (!puuid) {
      return NextResponse.json(
        { error: "PUUID is required" },
        { status: 400 }
      );
    }

    // Remove account (handles active account switching automatically)
    await removeAccount(puuid);

    log.info(`Removed account ${puuid.substring(0, 8)}`);

    return NextResponse.json({
      success: true,
      message: "Account removed successfully",
    });
  } catch (error) {
    log.error("Failed to remove account:", error);
    return NextResponse.json(
      { error: "Failed to remove account" },
      { status: 500 }
    );
  }
}
