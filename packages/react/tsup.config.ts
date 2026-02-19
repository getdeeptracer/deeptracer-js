import { defineConfig } from "tsup"
import pkg from "./package.json"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: { compilerOptions: { composite: false } },
  clean: true,
  target: "es2022",
  external: [...Object.keys(pkg.dependencies ?? {}), ...Object.keys(pkg.peerDependencies ?? {})],
  esbuildOptions(options) {
    options.jsx = "automatic"
  },
  banner: {
    js: '"use client";',
  },
})
