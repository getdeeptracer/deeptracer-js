---
"@deeptracer/core": minor
"@deeptracer/nextjs": minor
"@deeptracer/node": minor
"@deeptracer/ai": minor
"@deeptracer/browser": minor
"@deeptracer/react": minor
---

Turbopack source map support + release on all events

**@deeptracer/nextjs**: Replace webpack plugin with `compiler.runAfterProductionCompile` for source map upload. The webpack plugin was silently ignored by Turbopack (default bundler in Next.js 16). The new post-build hook works with webpack, Turbopack, and any future bundler. Also adds a 30s fetch timeout to prevent build hangs during upload.

**@deeptracer/core**: Send `release` with all event types (logs, traces, LLM usage) — not just errors. Enables deployment correlation across all data. Added `release` field to `LogEntry` and `SpanData` interfaces.
