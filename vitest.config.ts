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
      ],
      thresholds: {
        statements: 65,
        branches: 70,
        functions: 71,
        lines: 65,
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
