import { NextResponse } from "next/server";
import { getSession } from "@/lib/session";
import { removeAccount, getActiveAccount } from "@/lib/accounts";
import { clearCachedStore } from "@/lib/store-cache";

export async function POST() {
  const session = await getSession();
  if (session?.puuid) {
    clearCachedStore(session.puuid);
  }

  // Get active account and remove it from the registry
  // This will automatically switch to next account or clear session if none remain
  const activeAccount = await getActiveAccount();
  if (activeAccount) {
    await removeAccount(activeAccount.puuid);
  }

  return NextResponse.json({ success: true });
}
