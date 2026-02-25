---
"@deeptracer/core": patch
"@deeptracer/node": patch
"@deeptracer/ai": patch
"@deeptracer/browser": patch
"@deeptracer/react": patch
"@deeptracer/nextjs": patch
---

Fix silent log drops in Vercel serverless and short-lived route handlers

**Root cause:** `withContext()` and `forRequest()` created independent `Batcher` and `Transport` instances per child logger. In serverless environments, the 5-second batch timer never fires before the execution context freezes — and even calling `flush()` on the parent logger only drained the parent's batcher, not the child's.

**Fixes:**

- Child loggers (`withContext`, `forRequest`, span children) now share the root logger's `Batcher` and `Transport`. State isolation (user, tags, breadcrumbs) is unchanged — `cloneState()` still runs.
- `flush()` is now `async` and returns `Promise<void>`. It flushes the batcher and awaits `transport.drain()`, ensuring in-flight HTTP requests complete before resolving.
- `withRouteHandler` and `withServerAction` now call `await logger.flush()` in a `finally` block, guaranteeing delivery for all logs from the entire request — including child loggers — before the response is returned to Vercel.
- `destroy()` on a child logger no longer stops the root logger's batch timer (`isRoot` guard added).
- Default `flushIntervalMs` is now `200ms` in serverless environments (`VERCEL` or `AWS_LAMBDA_FUNCTION_NAME` detected), down from `5000ms`.
