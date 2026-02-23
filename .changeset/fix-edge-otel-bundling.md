---
"@deeptracer/nextjs": patch
---

Fix Edge Function build error caused by OTel packages

Add separate edge entry point (`index.edge.ts`) that doesn't include OpenTelemetry dependencies. Vercel Edge Functions now resolve to a clean bundle without `diagnostics_channel` or other Node.js built-in references. Logging and error capture work identically on both Node.js and Edge runtimes.
