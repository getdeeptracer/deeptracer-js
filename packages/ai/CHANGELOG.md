# @deeptracer/ai

## 0.7.0

### Patch Changes

- Updated dependencies [374afbe]
- Updated dependencies [15d3da3]
  - @deeptracer/core@0.7.0

## 0.6.4

### Patch Changes

- @deeptracer/core@0.6.4

## 0.6.3

### Patch Changes

- e667a19: Fix silent log drops in Vercel serverless and short-lived route handlers

  **Root cause:** `withContext()` and `forRequest()` created independent `Batcher` and `Transport` instances per child logger. In serverless environments, the 5-second batch timer never fires before the execution context freezes — and even calling `flush()` on the parent logger only drained the parent's batcher, not the child's.

  **Fixes:**
  - Child loggers (`withContext`, `forRequest`, span children) now share the root logger's `Batcher` and `Transport`. State isolation (user, tags, breadcrumbs) is unchanged — `cloneState()` still runs.
  - `flush()` is now `async` and returns `Promise<void>`. It flushes the batcher and awaits `transport.drain()`, ensuring in-flight HTTP requests complete before resolving.
  - `withRouteHandler` and `withServerAction` now call `await logger.flush()` in a `finally` block, guaranteeing delivery for all logs from the entire request — including child loggers — before the response is returned to Vercel.
  - `destroy()` on a child logger no longer stops the root logger's batch timer (`isRoot` guard added).
  - Default `flushIntervalMs` is now `200ms` in serverless environments (`VERCEL` or `AWS_LAMBDA_FUNCTION_NAME` detected), down from `5000ms`.

- Updated dependencies [e667a19]
  - @deeptracer/core@0.6.3

## 0.6.2

### Patch Changes

- @deeptracer/core@0.6.2

## 0.6.1

### Patch Changes

- @deeptracer/core@0.6.1

## 0.6.0

### Minor Changes

- a952d51: Graceful degradation: init() returns a no-op logger instead of throwing when API key or endpoint is missing. Move noopLogger to @deeptracer/core so all packages can share it. This ensures builds (e.g. next build in CI) succeed even without DeepTracer env vars.

### Patch Changes

- Updated dependencies [a952d51]
  - @deeptracer/core@0.6.0

## 0.5.1

### Patch Changes

- Updated dependencies [e37e8c5]
  - @deeptracer/core@0.5.1

## 0.5.0

### Minor Changes

- bdd3fc5: Add boundary-neutral `@deeptracer/nextjs/universal` entry point for shared code imported by both server and client. Migrate all docs from secretKey/publicKey to single apiKey field.

### Patch Changes

- Updated dependencies [bdd3fc5]
  - @deeptracer/core@0.5.0

## 0.4.3

### Patch Changes

- @deeptracer/core@0.4.3

## 0.4.2

### Patch Changes

- a492ffa: Fix withRouteHandler TypeScript contravariance with NextRequest, fix Express middleware cross-request state leak, add Transport silent no-op mode when no API key or endpoint is configured (eliminates console noise during local development), add warn-once behavior for transport failures (first failure warns, subsequent identical failures are suppressed), update all documentation to match v0.4.x API (secretKey/publicKey, remove product field, correct environment variable names, document provider-free error reporting in global-error.tsx, add Common Mistakes section, add server logger usage examples, add console replacement AI agent prompt), add engines field to all packages, add optional peerDependencies for AI package.
- Updated dependencies [a492ffa]
  - @deeptracer/core@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [c98c043]
  - @deeptracer/core@0.4.1
