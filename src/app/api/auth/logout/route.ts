import { NextResponse } from "next/server";
import { getSession, deleteSession } from "@/lib/session";
import { clearCachedStore } from "@/lib/store-cache";

export async function POST() {
  const session = await getSession();
  if (session?.puuid) {
    clearCachedStore(session.puuid);
  }
  await deleteSession();
  return NextResponse.json({ success: true });
}
