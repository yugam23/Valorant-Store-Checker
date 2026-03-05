import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/__tests__/**/*.test.ts"],
    env: {
      LOG_LEVEL: "warn",
    },
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/app/api/**/*.ts"],
      exclude: [
        "src/lib/__tests__/**",
        "src/lib/db.ts",
        "**/*.d.ts",
      ],
      thresholds: {
        statements: 18,
        branches: 11,
        functions: 16,
        lines: 18,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
