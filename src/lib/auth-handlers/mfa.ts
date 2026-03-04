/**
 * MFA Auth Handler
 *
 * Handles MFA code submission flow.
 * Submits a one-time code to complete multi-factor authentication.
 */

import { NextResponse } from "next/server";
import { submitMfa } from "@/lib/riot-auth";
import { registerAuthenticatedSession } from "./shared";
import type { AuthBody } from "./shared";

export async function handleMfaAuth(
  body: Extract<AuthBody, { type: "multifactor" }>,
): Promise<NextResponse> {
  const result = await submitMfa(body.code, body.cookie);

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "MFA verification failed" },
      { status: 401 },
    );
  }

  await registerAuthenticatedSession(result.tokens, result.riotCookies ?? "");

  return NextResponse.json({
    success: true,
    data: {
      puuid: result.tokens.puuid,
      region: result.tokens.region,
    },
  });
}
