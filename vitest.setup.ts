import { vi } from "vitest";

// Mock next/headers — used by session.ts for cookie access.
// Provides a controllable cookies() stub for session tests.
vi.mock("next/headers", () => ({
  cookies: vi.fn(() => ({
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
  })),
}));

// Mock next/navigation — used by page components for redirects.
// Not directly tested but imported transitively.
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  usePathname: vi.fn(() => "/"),
}));

// Mock @/lib/env — env.ts validates env vars at import time and throws
// without SESSION_SECRET. This mock prevents that and provides test values.
vi.mock("@/lib/env", () => ({
  env: {
    SESSION_SECRET: "test-secret-key-for-vitest",
    NODE_ENV: "test",
    LOG_LEVEL: "warn",
    HENRIK_API_KEY: "",
    SESSION_DB_PATH: undefined,
  },
}));
