import { defineConfig } from "vitest/config"

export default defineConfig({
  test: {
    name: "nextjs",
    include: ["src/__tests__/**/*.test.ts"],
    environment: "node",
    restoreMocks: true,
  },
})
