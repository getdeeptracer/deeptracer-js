---
"@deeptracer/nextjs": patch
"@deeptracer/core": patch
---

Fix `register` return type in `InitResult` (`() => void` → `() => Promise<void>`) — previously TypeScript did not flag missing `await` when wrapping `deeptracer.register()` in a custom register function, causing OTel setup and the fetch patch to run in the background instead of completing before the first request.

Add README documentation:
- Custom `register()` wrapper pattern showing `await deeptracer.register()`
- `new Request(existingReq, options)` copy-constructor crash on Next.js 16 with safe `Proxy` alternative
- `debug: true` diagnostic guide for silent log drops
- Multi-logger-instance anti-pattern and singleton fix

Add regression test: module-level `withContext` child flushed by per-request `forRequest` sibling flush (Better Auth `sendOTP` pattern).
