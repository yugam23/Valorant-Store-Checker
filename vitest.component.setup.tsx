import { vi } from "vitest";

// Mock next/image — renders an img tag with passed props
vi.mock("next/image", () => ({
  default: function MockImage(props: React.ComponentProps<"img">) {
    return <img alt="" {...props} />;
  },
}));

// Mock @/lib/edition-icons — getEditionIconPath returns null (no edition icon)
vi.mock("@/lib/edition-icons", () => ({
  getEditionIconPath: vi.fn(() => null),
}));

// Mock @/lib/env — provide minimal env object with required fields
vi.mock("@/lib/env", () => ({
  env: {
    SESSION_SECRET: "test-secret-key-for-vitest",
    NODE_ENV: "test",
    LOG_LEVEL: "warn",
    HENRIK_API_KEY: "",
    SESSION_DB_PATH: undefined,
  },
}));

// Mock next/navigation — provide useRouter with push/replace mocks
vi.mock("next/navigation", () => ({
  redirect: vi.fn(),
  useRouter: vi.fn(() => ({ push: vi.fn(), replace: vi.fn() })),
  usePathname: vi.fn(() => "/"),
}));
