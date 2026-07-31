// Flat config (ESLint 10 dropped .eslintrc support entirely — see docs/CONVENTIONS.md
// note in the scaffolding PR description for why this replaces .eslintrc.cjs).
//
// eslint-config-next@16 exports native flat-config arrays (dist/core-web-vitals.js does
// `module.exports = [...]`), so it's imported directly rather than through
// @eslint/eslintrc's FlatCompat — FlatCompat expects legacy .eslintrc-shaped configs and
// throws ("Converting circular structure to JSON") when handed an already-flat array
// whose plugin objects (eslint-plugin-react) self-reference via `configs`.
import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";

export default tseslint.config(
  {
    ignores: [
      "**/.next/**",
      "**/dist/**",
      "**/build/**",
      "**/node_modules/**",
      "**/coverage/**",
      "**/.turbo/**",
      "**/playwright-report/**",
      "**/test-results/**",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-non-null-assertion": "error",
    },
  },
  ...nextCoreWebVitals.map((config) => ({
    ...config,
    files: ["apps/web/**/*.{ts,tsx}"],
  })),
  {
    files: ["**/*.config.{js,mjs,ts}", "**/*.d.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
);
