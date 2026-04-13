import { NextRequest, NextResponse } from "next/server";
import { getSession, deleteSession } from "@/lib/session";
import { removeAccount, getActiveAccount } from "@/lib/accounts";
import { clearCachedStore } from "@/lib/store-cache";
import { rateLimit } from "@/lib/rate-limiter";
import { getClientIP, addRateLimitHeaders, createRateLimitedResponse } from "@/lib/rate-limit-utils";

export async function POST(request: NextRequest) {
  // Rate limit check before processing logout
  const ip = getClientIP(request);
  const { success, limit, remaining, reset } = await rateLimit(ip);
  if (!success) {
    return createRateLimitedResponse({ limit, remaining, reset });
  }

  const session = await getSession();
  if (session?.puuid) {
    await clearCachedStore(session.puuid);
  }

  // Get active account and remove it from the registry
  // This will automatically switch to next account or clear session if none remain
  const activeAccount = await getActiveAccount();
  if (activeAccount) {
    await removeAccount(activeAccount.puuid);
  }

  // Explicitly delete the main session to clear the session store and invalidate cache
  // This ensures complete logout even if removeAccount switched to another account
  await deleteSession();

  const response = NextResponse.json({ success: true });
  return addRateLimitHeaders(response, { limit, remaining, reset });
}
