import js from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

// Size limits from docs/working.md section 4; scripts/check_limits.py checks the same files.
export default defineConfig([
  globalIgnores(["dist/", "src/contracts/*.gen.ts"]),
  {
    files: ["**/*.ts"],
    extends: [js.configs.recommended, tseslint.configs.strict],
    languageOptions: { parserOptions: { projectService: true } },
    rules: {
      "max-lines": ["error", { max: 250, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": ["error", { max: 30 }],
      complexity: ["error", 8],
      "max-params": ["error", 4],
      "max-depth": ["error", 3],
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },
  {
    files: ["tests/**/*.ts"],
    rules: {
      "max-lines": ["error", { max: 400, skipBlankLines: true, skipComments: true }],
      "max-lines-per-function": "off",
    },
  },
]);
