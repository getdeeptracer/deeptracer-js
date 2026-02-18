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
npm run typecheck      # Type-check all packages
npm run lint           # ESLint across all packages
npm run format:check   # Prettier format check
npm run format         # Prettier auto-fix
npm run size           # Check bundle size budgets
```

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

## Version Bumping

When releasing, update ALL of these:
1. `packages/core/src/version.ts` — `SDK_VERSION` constant
2. Root `package.json` — `version` field
3. All 6 `packages/*/package.json` — `version` field
4. All internal `@deeptracer/*` dependency versions in package.json files

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
