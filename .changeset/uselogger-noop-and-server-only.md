---
"@deeptracer/react": patch
"@deeptracer/nextjs": patch
---

Make useLogger() safe to call without a provider — returns a no-op logger during SSR/SSG instead of throwing. Add server-only guard to @deeptracer/nextjs server entry for clear build errors on accidental client imports. Explicitly export createLogger from @deeptracer/nextjs/client.
