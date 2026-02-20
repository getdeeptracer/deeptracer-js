# @deeptracer/nextjs

## 0.5.0

### Minor Changes

- bdd3fc5: Add boundary-neutral `@deeptracer/nextjs/universal` entry point for shared code imported by both server and client. Migrate all docs from secretKey/publicKey to single apiKey field.

### Patch Changes

- Updated dependencies [bdd3fc5]
  - @deeptracer/core@0.5.0
  - @deeptracer/node@0.5.0
  - @deeptracer/react@0.5.0

## 0.4.3

### Patch Changes

- de379f7: Make useLogger() safe to call without a provider — returns a no-op logger during SSR/SSG instead of throwing. Add server-only guard to @deeptracer/nextjs server entry for clear build errors on accidental client imports. Explicitly export createLogger from @deeptracer/nextjs/client.
- Updated dependencies [de379f7]
  - @deeptracer/react@0.4.3
  - @deeptracer/core@0.4.3
  - @deeptracer/node@0.4.3

## 0.4.2

### Patch Changes

- a492ffa: Fix withRouteHandler TypeScript contravariance with NextRequest, fix Express middleware cross-request state leak, add Transport silent no-op mode when no API key or endpoint is configured (eliminates console noise during local development), add warn-once behavior for transport failures (first failure warns, subsequent identical failures are suppressed), update all documentation to match v0.4.x API (secretKey/publicKey, remove product field, correct environment variable names, document provider-free error reporting in global-error.tsx, add Common Mistakes section, add server logger usage examples, add console replacement AI agent prompt), add engines field to all packages, add optional peerDependencies for AI package.
- Updated dependencies [a492ffa]
  - @deeptracer/core@0.4.2
  - @deeptracer/node@0.4.2
  - @deeptracer/react@0.4.2

## 0.4.1

### Patch Changes

- Updated dependencies [c98c043]
  - @deeptracer/core@0.4.1
  - @deeptracer/node@0.4.1
  - @deeptracer/react@0.4.1
