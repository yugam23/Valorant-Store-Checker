/**
 * MSW Server Startup Hook
 *
 * This module is loaded via `node --import` before Next.js starts.
 * It initializes MSW only when ENABLE_MSW=true, completely outside
 * of the Next.js build process to avoid Turbopack analysis issues.
 *
 * Usage: node --import ./src/lib/msw/start.ts next start
 */

import { setupServer } from "msw/node";
import { handlers } from "./handlers";

// Guard against double-init on hot reload
// eslint-disable-next-line @typescript-eslint/no-explicit-any
if (!(globalThis as any).__mswServer__) {
  const server = setupServer(...handlers);
  server.listen({ onUnhandledRequest: "bypass" });
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (globalThis as any).__mswServer__ = server;
  console.log("[MSW] Node server started for E2E tests");
}