# @deeptracer/nextjs

## 0.6.2

### Patch Changes

- f9138ac: Fix Edge Function build error caused by OTel packages

  Add separate edge entry point (`index.edge.ts`) that doesn't include OpenTelemetry dependencies. Vercel Edge Functions now resolve to a clean bundle without `diagnostics_channel` or other Node.js built-in references. Logging and error capture work identically on both Node.js and Edge runtimes.
  - @deeptracer/core@0.6.2
  - @deeptracer/node@0.6.2
  - @deeptracer/react@0.6.2

## 0.6.1

### Patch Changes

- 4000125: Fix OpenTelemetry packages leaking into client bundle

  Add `withDeepTracer()` config wrapper (`@deeptracer/nextjs/config`) that adds OTel packages to `serverExternalPackages`, preventing Webpack/Turbopack from bundling Node.js-only modules like `diagnostics_channel` into client chunks. Also add `/* webpackIgnore: true */` to dynamic OTel imports as defense-in-depth for Webpack.
  - @deeptracer/core@0.6.1
  - @deeptracer/node@0.6.1
  - @deeptracer/react@0.6.1

## 0.6.0

### Minor Changes

- a952d51: Graceful degradation: init() returns a no-op logger instead of throwing when API key or endpoint is missing. Move noopLogger to @deeptracer/core so all packages can share it. This ensures builds (e.g. next build in CI) succeed even without DeepTracer env vars.

### Patch Changes

- Updated dependencies [a952d51]
  - @deeptracer/core@0.6.0
  - @deeptracer/node@0.6.0
  - @deeptracer/react@0.6.0

## 0.5.1

### Patch Changes

- e37e8c5: Migrate source code from secretKey/publicKey to single apiKey field. Server env var is now DEEPTRACER_KEY (was DEEPTRACER_SECRET_KEY). Client env var stays NEXT_PUBLIC_DEEPTRACER_KEY.
- Updated dependencies [e37e8c5]
  - @deeptracer/core@0.5.1
  - @deeptracer/node@0.5.1
  - @deeptracer/react@0.5.1

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
