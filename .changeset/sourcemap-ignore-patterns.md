---
"@deeptracer/nextjs": patch
---

feat(nextjs): add `ignore` option to filter source map uploads

Adds a configurable `ignore` option to `withDeepTracer()` (and `DeepTracerSourceMapConfig`) that excludes source map files matching any of the provided path substrings.

**Default:** `["node_modules"]` — third-party source maps (e.g. packages copied into `.next/` by Turbopack via `serverExternalPackages`) are now silently excluded from every upload. No config change required.

**Custom patterns:**
```ts
// add patterns on top of the default
withDeepTracer(nextConfig, { ignore: ["node_modules", "vendor"] })

// upload everything — disable all filtering
withDeepTracer(nextConfig, { ignore: [] })
```

Patterns are matched as substrings of the path relative to `distDir`, normalised to forward slashes on all platforms.
