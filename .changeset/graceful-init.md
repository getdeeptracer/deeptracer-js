---
"@deeptracer/core": minor
"@deeptracer/node": minor
"@deeptracer/browser": minor
"@deeptracer/react": minor
"@deeptracer/nextjs": minor
"@deeptracer/ai": minor
---

Graceful degradation: init() returns a no-op logger instead of throwing when API key or endpoint is missing. Move noopLogger to @deeptracer/core so all packages can share it. This ensures builds (e.g. next build in CI) succeed even without DeepTracer env vars.
