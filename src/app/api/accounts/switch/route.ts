/**
 * Account Switching API Route
 *
 * Endpoint:
 * - POST /api/accounts/switch - Switch to a different account
 *
 * Security:
 * - Uses account registry from cookies
 * - Swaps active session to target account
 */

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { parseBody, withSession } from "@/lib/api-validate";
import { switchAccount, getActiveAccount } from "@/lib/accounts";
import { createLogger } from "@/lib/logger";

const log = createLogger("Switch Account API");

const SwitchAccountSchema = z.object({
  puuid: z.string().min(1),
});

/**
 * POST /api/accounts/switch
 * Switch active account to a different stored account
 */
export const POST = withSession(async (request: NextRequest) => {
  try {
    const parsed = await parseBody(request, SwitchAccountSchema);
    if (!parsed.success) return parsed.response;

    const { puuid } = parsed.data;

    // Attempt to switch accounts
    const success = await switchAccount(puuid);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to switch account. Account may not exist or session may be expired." },
        { status: 404 }
      );
    }

    // Get the newly active account
    const activeAccount = await getActiveAccount();

    log.info(`Switched to account ${puuid.substring(0, 8)}`);

    return NextResponse.json({
      success: true,
      message: "Account switched successfully",
      activeAccount: activeAccount ? {
        puuid: activeAccount.puuid,
        region: activeAccount.region,
        gameName: activeAccount.gameName,
        tagLine: activeAccount.tagLine,
      } : null,
    });
  } catch (error) {
    log.error("Failed to switch account:", error);
    return NextResponse.json(
      { error: "Failed to switch account" },
      { status: 500 }
    );
  }
});
