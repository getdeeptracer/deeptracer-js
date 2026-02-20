import { defineConfig } from "tsup"
import pkg from "./package.json"

const external = [
  ...Object.keys(pkg.dependencies ?? {}),
  ...Object.keys(pkg.peerDependencies ?? {}),
]

export default defineConfig([
  {
    entry: ["src/index.server.ts", "src/index.types.ts", "src/index.universal.ts"],
    format: ["esm", "cjs"],
    dts: { compilerOptions: { composite: false } },
    clean: false,
    target: "es2022",
    external,
  },
  {
    entry: ["src/index.client.ts"],
    format: ["esm", "cjs"],
    dts: { compilerOptions: { composite: false } },
    clean: false,
    target: "es2022",
    external,
    banner: { js: '"use client";' },
  },
])
