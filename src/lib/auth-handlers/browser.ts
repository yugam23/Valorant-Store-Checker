/**
 * Browser Auth Handler
 *
 * Handles browser launch authentication flow.
 * Launches an interactive browser window for OAuth-style authentication.
 */

import { NextResponse } from "next/server";
import type { AuthBody } from "./shared";

export async function handleBrowserAuth(
  _body: Extract<AuthBody, { type: "launch_browser" }>,
): Promise<NextResponse> {
  const { launchBasicBrowser } = await import("@/lib/browser-auth");
  const result = await launchBasicBrowser();

  if (!result.success) {
    return NextResponse.json(
      { error: result.error || "Failed to launch browser" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    success: true,
    message: "Browser launched successfully",
  });
}
