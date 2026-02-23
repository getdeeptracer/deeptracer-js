# @deeptracer/core

## 0.6.2

## 0.6.1

## 0.6.0

### Minor Changes

- a952d51: Graceful degradation: init() returns a no-op logger instead of throwing when API key or endpoint is missing. Move noopLogger to @deeptracer/core so all packages can share it. This ensures builds (e.g. next build in CI) succeed even without DeepTracer env vars.

## 0.5.1

### Patch Changes

- e37e8c5: Migrate source code from secretKey/publicKey to single apiKey field. Server env var is now DEEPTRACER_KEY (was DEEPTRACER_SECRET_KEY). Client env var stays NEXT_PUBLIC_DEEPTRACER_KEY.

## 0.5.0

### Minor Changes

- bdd3fc5: Add boundary-neutral `@deeptracer/nextjs/universal` entry point for shared code imported by both server and client. Migrate all docs from secretKey/publicKey to single apiKey field.

## 0.4.3

## 0.4.2

### Patch Changes

- a492ffa: Fix withRouteHandler TypeScript contravariance with NextRequest, fix Express middleware cross-request state leak, add Transport silent no-op mode when no API key or endpoint is configured (eliminates console noise during local development), add warn-once behavior for transport failures (first failure warns, subsequent identical failures are suppressed), update all documentation to match v0.4.x API (secretKey/publicKey, remove product field, correct environment variable names, document provider-free error reporting in global-error.tsx, add Common Mistakes section, add server logger usage examples, add console replacement AI agent prompt), add engines field to all packages, add optional peerDependencies for AI package.

## 0.4.1

### Patch Changes

- c98c043: Fix child logger state isolation to prevent cross-request data leaks, add test suite with 97 tests, and set up automated release pipeline
