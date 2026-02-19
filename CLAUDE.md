# DeepTracer JavaScript SDK

AI-first observability SDK for JavaScript/TypeScript. Structured logging, error tracking, distributed tracing, and LLM usage monitoring.

## Monorepo Structure

```
packages/
  core/       — Zero-dependency shared core: Logger, transport, batcher, tracing, types
  node/       — Node.js/Bun: global error capture, console capture, Hono & Express middleware
  ai/         — AI SDK wrappers: Vercel AI SDK, OpenAI, Anthropic
  browser/    — Browser: window error capture, console capture
  react/      — React: provider, error boundary, hooks
  nextjs/     — Next.js: one-file server + client instrumentation
```

## Dependency Graph

```
core (zero dependencies)
 ├── node    (depends on core)
 ├── ai      (depends on core)
 └── browser (depends on core)
      └── react   (depends on browser)
           └── nextjs (depends on node + react)
```

## Commands

```bash
npm run build          # Build all packages (in dependency order)
npm run clean          # Remove all dist/ folders
npm test               # Run all tests (once)
npm run test:watch     # Run tests in watch mode
npm run test:coverage  # Run tests with coverage report
npm run typecheck      # Type-check all packages
npm run lint           # ESLint across all packages
npm run format:check   # Prettier format check
npm run format         # Prettier auto-fix
npm run size           # Check bundle size budgets
```

## Testing

- **Runner**: Vitest (v4) with workspace projects
- **Test location**: `packages/*/src/__tests__/*.test.ts` (co-located with source)
- **Run single package**: `npx vitest run --project core`
- **Coverage**: V8 provider via `npm run test:coverage`, reports in `./coverage/`
- **Mocking**: Mock `globalThis.fetch` for transport tests, `vi.useFakeTimers()` for batcher tests

## Build System

- **Bundler**: tsup (esbuild-based)
- **Output**: ESM + CJS + .d.ts for every package
- **Target**: ES2022
- **Build order**: core → node, ai, browser (parallel) → react → nextjs

## Conventions

- All packages use `tsup.config.ts` for build configuration
- All packages extend `../../tsconfig.base.json`
- Internal dependencies use exact versions (e.g., `"@deeptracer/core": "0.3.1"`)
- `@deeptracer/core` has zero runtime dependencies — keep it that way
- Platform packages (node, browser) re-export everything from core
- React package has `"use client"` banner in tsup output
- Next.js package has two entry points: main (server) and `./client` (React re-exports)

## Releasing

This repo uses [@changesets/cli](https://github.com/changesets/changesets) with **lockstep versioning** — all 6 packages always share the same version.

**Adding a changeset (during development):**
```bash
npx changeset        # interactive — pick packages + bump type + summary
```

**How releases work:**
1. Changesets accumulate in `.changeset/` as PRs merge to `main`
2. A GitHub Action creates a "Version Packages" PR (bumps versions + generates changelogs)
3. Merging that PR triggers `npm publish` with provenance for all packages

**Manual release (if needed):**
```bash
npm run version      # changeset version + sync version.ts
npm run release      # build all + changeset publish
```

**Setup required:** Configure [npm Trusted Publishing](https://docs.npmjs.com/generating-provenance-statements#publishing-packages-with-provenance-via-github-actions) for all 6 `@deeptracer/*` packages (no token needed — uses GitHub OIDC)

## Key Files

- `packages/core/src/logger.ts` — Main Logger class with all logging, tracing, and error methods
- `packages/core/src/types.ts` — All TypeScript interfaces and types
- `packages/core/src/transport.ts` — HTTP transport with retry, backoff, and drain
- `packages/core/src/state.ts` — Shared mutable state (user, tags, contexts, breadcrumbs)
- `packages/node/src/middleware.ts` — Hono and Express middleware
- `packages/nextjs/src/init.ts` — Next.js `init()` returning `{ register, onRequestError, logger }`
- `packages/react/src/context.tsx` — DeepTracerProvider with zero-config env var fallback

## Target Audience

This SDK is designed for **vibe coders** (beginners) whose codebases are modified by **AI agents** (Cursor, Claude Code, Copilot). Prioritize:
- Minimal setup (1 file, 5 lines for Next.js)
- Zero decisions — one clear path, no "choose between A or B"
- Comprehensive JSDoc — AI agents read type definitions
- Fail gracefully — warn on misconfiguration, never crash
