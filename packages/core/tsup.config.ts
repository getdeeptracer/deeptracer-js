import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts", "src/internal.ts"],
  format: ["esm", "cjs"],
  dts: { compilerOptions: { composite: false } },
  clean: true,
  target: "es2022",
})
