import eslint from "@eslint/js"
import tseslint from "typescript-eslint"

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Allow unused vars prefixed with _
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // Allow explicit any in SDK code (wrapping unknown user types)
      "@typescript-eslint/no-explicit-any": "warn",
      // Allow empty functions (common in SDK stubs)
      "@typescript-eslint/no-empty-function": "off",
      // Allow non-null assertions (SDK internals know their state)
      "@typescript-eslint/no-non-null-assertion": "off",
    },
  },
  {
    files: ["**/__tests__/**/*.ts"],
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    ignores: ["**/dist/", "**/node_modules/", "eslint.config.js"],
  },
)
