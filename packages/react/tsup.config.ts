import { defineConfig } from "tsup"

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm", "cjs"],
  dts: true,
  clean: true,
  target: "es2022",
  external: ["@deeptracer/core", "@deeptracer/browser", "react", "react-dom"],
  esbuildOptions(options) {
    options.jsx = "automatic"
  },
  banner: {
    js: '"use client";',
  },
})
