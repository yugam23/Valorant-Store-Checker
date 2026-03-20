import { defineConfig } from "vitest/config";
import path from "path";
import react from "@vitejs/plugin-react";
import type { TestProjectConfiguration } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        extends: true,
        name: "node",
        environment: "node",
        include: ["src/**/__tests__/**/*.test.ts"],
        setupFiles: ["./vitest.setup.ts"],
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
      {
        extends: true,
        name: "happy-dom",
        environment: "happy-dom",
        plugins: [react()],
        include: ["src/**/*.test.tsx"],
      },
    ] as TestProjectConfiguration[],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
});
