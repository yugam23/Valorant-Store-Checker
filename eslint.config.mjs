import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import security from "eslint-plugin-security";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  security.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
        caughtErrorsIgnorePattern: "^_",
      }],
      // Disabled globally: TypeScript's type system already guards against arbitrary key injection
      // when typed string keys are used (bracket access on Record/index-signature types).
      // 13 false-positive sites across the codebase — exceeds the acceptable inline-disable threshold.
      "security/detect-object-injection": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // External tooling & agent configuration (CommonJS, GSD, skills):
    ".claude/**",
    ".gemini/**",
    ".agents/**",
    ".agent/**",
    ".planning/**",

    // Auto-generated coverage instrumentation:
    "coverage/**",
  ]),
]);

export default eslintConfig;
