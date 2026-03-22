import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  test: {
    coverage: {
      provider: "v8" as const,
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: [
        "src/lib/__tests__/**",
        "src/lib/db.ts",
        "**/*.d.ts",
        // Infrastructure files that require external services or are not unit-testable
        "src/lib/env.ts",
        "src/lib/redis-client.ts",
        "src/lib/rate-limiter.ts",
        "src/lib/session-db.ts",
        "src/lib/msw/**",
        "src/lib/nav.ts",
        "src/lib/edition-icons.ts",
        // API routes that are integration-level or require external services
        "src/app/api/accounts/**",
        "src/app/api/inventory/**",
        // Files that are data-only or external API wrappers
        "src/lib/henrik-api.ts",
        "src/lib/accounts.ts",
        "src/lib/riot-inventory.ts",
        "src/lib/riot-loadout.ts",
        "src/lib/store-service.ts",
        "src/lib/wishlist.ts",
        "src/lib/inventory-cache.ts",
        // Crypto utility with hard-to-test edge cases
        "src/lib/session-crypto.ts",
      ],
      thresholds: {
        perFile: true,
        statements: 70,
        branches: 70,
        functions: 70,
        lines: 70,
      },
    },
    projects: [
      {
        name: "node",
        test: {
          environment: "node",
          include: ["src/**/__tests__/**/*.test.ts"],
          setupFiles: ["./vitest.setup.ts"],
        },
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src"),
          },
        },
      },
      {
        name: "happy-dom",
        test: {
          environment: "happy-dom",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./vitest.component.setup.tsx"],
        },
        plugins: [react()],
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "src"),
          },
        },
      },
    ],
  },
});
