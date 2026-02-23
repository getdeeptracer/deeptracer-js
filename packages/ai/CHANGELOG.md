# @deeptracer/ai

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
