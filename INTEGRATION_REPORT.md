# DeepTracer Integration Report: AI Agent's Perspective

> **Context:** Claude (AI agent) replaced Sentry with DeepTracer across a production Next.js 15 monorepo (Spotbeam — 2 apps, ~500+ files modified). This document captures every real challenge encountered and proposes fixes to make DeepTracer truly plug-and-play for vibe coders, beginners, and AI agents.

---

## The Project

- **Monorepo:** pnpm workspaces with `apps/dashboard` (Next.js 15.5) and `apps/storefront` (Next.js 16.1)
- **Scale:** ~1,050 console calls replaced, ~214 API route handlers wrapped, 143 error-capture imports migrated
- **Previous:** Sentry in dashboard only, zero tracking in storefront

---

## Challenge 1: Build Breaks in pnpm Monorepos (CRITICAL)

### What Happened

The storefront build fails:

```
Module not found: Can't resolve '@deeptracer/core'
  at ./node_modules/.pnpm/@deeptracer+nextjs@0.3.1_.../dist/index.js:5
```

### Root Cause

`tsup.config.ts` marks `@deeptracer/core` as `external`:

```ts
// packages/nextjs/tsup.config.ts
external: [
  "@deeptracer/core",   // <-- This is the problem
  "@deeptracer/node",
  ...
]
```

So the built `dist/index.js` contains a bare import:

```js
import { createLogger } from "@deeptracer/core"  // line 5
```

But `@deeptracer/core` is NOT a direct dependency of `@deeptracer/nextjs`. The dependency chain is:

```
@deeptracer/nextjs
  -> @deeptracer/node (direct dep)
       -> @deeptracer/core (transitive dep)
```

In pnpm's strict isolation model, Turbopack resolves modules from within `.pnpm/@deeptracer+nextjs@0.3.1_.../node_modules/` — and `@deeptracer/core` doesn't exist there. It only exists inside `@deeptracer/node`'s own `node_modules/`.

Even `shamefully-hoist=true` doesn't fix this because Turbopack (and webpack) resolve from the importing file's location, not from the workspace root.

### What I Tried (None Worked)

1. Adding `@deeptracer/core` as a direct dep in the storefront's `package.json` — Turbopack still resolves from `.pnpm` path
2. `serverExternalPackages: ["@deeptracer/nextjs", "@deeptracer/core"]` in next.config — didn't help with Turbopack
3. `transpilePackages: ["@deeptracer/nextjs", "@deeptracer/core"]` — was testing when interrupted
4. Adding both `@deeptracer/core` and `@deeptracer/node` as direct deps — packages appear in `apps/storefront/node_modules/@deeptracer/` but Turbopack still can't resolve

### Fix for DeepTracer

**Option A (simplest):** Add `@deeptracer/core` as a direct dependency of `@deeptracer/nextjs`:

```json
// packages/nextjs/package.json
"dependencies": {
  "@deeptracer/core": "0.3.1",   // ADD THIS — init.ts imports from it directly
  "@deeptracer/node": "0.3.1",
  "@deeptracer/react": "0.3.1"
}
```

This is the correct fix. If your code imports from a package, that package must be in your direct dependencies. This is the npm/pnpm contract.

**Option B (alternative):** Don't mark `@deeptracer/core` as external in tsup — bundle it into the dist:

```ts
// packages/nextjs/tsup.config.ts
external: [
  // "@deeptracer/core",  // REMOVE — let tsup bundle it
  "@deeptracer/node",
  // ...
]
```

**Option C:** Don't import `@deeptracer/core` directly from the nextjs package. Re-export `createLogger` from `@deeptracer/node` (which IS a direct dep):

```ts
// packages/node/src/index.ts
export { createLogger } from "@deeptracer/core"  // re-export

// packages/nextjs/src/init.ts
import { createLogger } from "@deeptracer/node"  // import from direct dep instead
```

### Impact

This is a **P0 blocker**. Any pnpm monorepo user will hit this on first build. npm users may not hit it due to flat node_modules, which is why it might not have been caught in testing.

---

## Challenge 2: `withRouteHandler` Drops Next.js `{ params }` Argument

### What Happened

Almost every real Next.js app has dynamic routes like `/api/products/[id]`. The handler signature is:

```ts
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // ...
}
```

But `withRouteHandler` only accepts:

```ts
handler: (request: Request) => Promise<Response>
```

The second `{ params }` argument is silently dropped. This means you can't use `withRouteHandler` on any dynamic route — which is most routes in a real app.

### What I Did

Created a custom `wrapRoute()` wrapper in both apps:

```ts
// lib/utils/route-wrapper.ts
type RouteHandler = (...args: any[]) => Promise<any>;

export function wrapRoute<T extends RouteHandler>(name: string, handler: T): T {
  const wrapped = async (request: Request, context?: any): Promise<Response> => {
    const reqLogger = logger.forRequest(request);
    return reqLogger.startSpan(`route:${name}`, async () => {
      try {
        return await handler(request, context);  // Pass context through!
      } catch (error) {
        reqLogger.captureError(error, { ... });
        throw error;
      }
    });
  };
  return wrapped as unknown as T;
}
```

This works but means every DeepTracer user has to write their own wrapper, defeating the purpose of providing one.

### Fix for DeepTracer

Update `withRouteHandler` to pass through all arguments:

```ts
// packages/nextjs/src/route-handler.ts
export function withRouteHandler(
  logger: Logger,
  name: string,
  handler: (request: Request, context?: any) => Promise<Response>,
): (request: Request, context?: any) => Promise<Response> {
  return async (request: Request, context?: any): Promise<Response> => {
    const reqLogger = logger.forRequest(request)
    return reqLogger.startSpan(`route:${name}`, async () => {
      try {
        return await handler(request, context)  // <-- Pass context!
      } catch (error) {
        reqLogger.captureError(error, { ... })
        throw error
      }
    })
  }
}
```

Or even better, use a generic type to preserve the exact handler signature:

```ts
export function withRouteHandler<
  T extends (request: Request, ...args: any[]) => Promise<Response>
>(logger: Logger, name: string, handler: T): T {
  // ...
}
```

---

## Challenge 3: Server Logger Imported in Client Components = Build Failure

### What Happened

The standard setup creates `lib/logger.ts`:

```ts
import { init } from "@deeptracer/nextjs"
const deeptracer = init({ ... })
export const logger = deeptracer.logger
```

This works perfectly for server-side code (API routes, server components). But many real apps have files shared between server and client:

- `lib/cart/storage.ts` — uses `localStorage` (browser API)
- `lib/checkout/promotion-context.tsx` — React context provider (`"use client"`)
- `lib/tinybird/client.ts` — client-side analytics
- `components/checkout/RazorpayCheckout.tsx` — payment UI

When an AI agent replaces `console.error` with `logger.error` in these files, it naturally imports from `@/lib/logger`. But that pulls `@deeptracer/nextjs` → `@deeptracer/core` into the client bundle, which uses Node.js APIs and crashes:

```
Module not found: Can't resolve '@deeptracer/core'
  Client Component Browser:
    ./lib/logger.ts [Client Component Browser]
    ./lib/search/storage.ts [Client Component Browser]
    ./app/search/SearchPageClient.tsx [Client Component Browser]
```

### What I Did

Created a separate `lib/logger-client.ts` with console-based fallback:

```ts
// lib/logger-client.ts — browser-safe, DeepTracer captureConsole forwards these
export const logger = {
  info(message: string, data?: Record<string, unknown>) {
    data ? console.log(`[Storefront] ${message}`, data) : console.log(`[Storefront] ${message}`)
  },
  warn(message: string, data?: Record<string, unknown>) { ... },
  error(message: string, data?: Record<string, unknown>) { ... },
}
```

Then manually updated 19 client-side files to import from `@/lib/logger-client` instead of `@/lib/logger`.

This is **extremely error-prone** for both humans and AI agents. You have to know whether every file in the dependency tree is server-only or could be imported by a client component. Miss one file and the build breaks.

### Fix for DeepTracer

**Export a client-safe logger from `@deeptracer/nextjs/client`:**

```ts
// packages/nextjs/src/client.ts — ADD THIS
export { createLogger as createClientLogger } from "@deeptracer/browser"

// Or better — a pre-configured logger that reads from env:
export function getClientLogger(): Logger {
  // Uses @deeptracer/browser (no Node.js deps)
  return createLogger({
    endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT,
    apiKey: process.env.NEXT_PUBLIC_DEEPTRACER_API_KEY,
    // ...
  })
}
```

Then users can do:

```ts
// lib/logger.ts (server) — existing, no change
import { init } from "@deeptracer/nextjs"

// lib/logger-client.ts (browser-safe)
import { getClientLogger } from "@deeptracer/nextjs/client"
export const logger = getClientLogger()
```

**Even better — document the recommended pattern:**

```ts
// lib/logger.ts — universal, works everywhere
export const logger = typeof window === 'undefined'
  ? (await import("@deeptracer/nextjs")).init({ ... }).logger
  : (await import("@deeptracer/nextjs/client")).getClientLogger()
```

Or ship a `@deeptracer/nextjs/universal` export that handles this automatically.

---

## Challenge 4: `global-error.tsx` Can't Use Any DeepTracer Feature

### What Happened

Next.js `global-error.tsx` is a `"use client"` component that replaces the **entire HTML document** — including `<html>`, `<body>`, and all providers. This means:

1. `useLogger()` hook — fails (no `DeepTracerProvider` above it)
2. `useDeepTracerErrorReporter(error)` — fails (same reason)
3. `import { logger } from "@/lib/logger"` — fails (server-only module in client component)
4. `export { DeepTracerErrorPage as default }` — renders but **silently doesn't report** (logs a console.warn that nobody sees)

The `DeepTracerErrorPage` component checks for context and if missing, just warns:

```ts
if (logger) {
  logger.captureError(error, { ... })
} else {
  console.warn("[@deeptracer/react] No DeepTracerProvider found. Error not reported.")
}
```

This means the **most critical errors** (ones that crash the root layout) are the ones that **never get reported**.

### What I Did

Fell back to raw `console.error`:

```tsx
// global-error.tsx
"use client"
import { useEffect } from "react"

export default function GlobalError({ error, reset }) {
  // captureConsole: true forwards this to DeepTracer
  useEffect(() => {
    console.error("[GlobalError] Critical error", error)
  }, [error])
  // ...UI...
}
```

This works because `captureConsole: true` in the server-side init will forward it. But it's a leaky abstraction — the user has to know that `captureConsole` exists and is enabled for this to work.

### Fix for DeepTracer

When `DeepTracerErrorPage` has no provider above it (the `global-error.tsx` case), it should make a **direct HTTP call** to the DeepTracer endpoint instead of silently dropping the error:

```ts
// In DeepTracerErrorPage, when no provider:
if (!logger) {
  // Read config from env vars and send directly
  const endpoint = process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT
  const apiKey = process.env.NEXT_PUBLIC_DEEPTRACER_API_KEY
  if (endpoint && apiKey) {
    fetch(`${endpoint}/api/errors`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({
        error: { message: error.message, stack: error.stack, digest: error.digest },
        severity: 'critical',
        source: 'global-error-boundary',
      }),
      keepalive: true,  // ensures delivery even if page is unloading
    }).catch(() => {})  // best-effort
  }
}
```

This way `DeepTracerErrorPage` works as a true drop-in for `global-error.tsx` with zero configuration.

---

## Challenge 5: `captureConsole` Destroys Structured Metadata

### What Happened

The console interceptor in `init.ts` does:

```ts
console.error = (...args: unknown[]) => {
  logger.error(args.map(String).join(" "))
  origError(...args)
}
```

When code does:

```ts
console.error("Checkout failed", { orderId: "abc", amount: 4999, error: new Error("timeout") })
```

DeepTracer receives: `"Checkout failed [object Object]"` — all structured data is lost.

### Fix for DeepTracer

Parse args more intelligently:

```ts
console.error = (...args: unknown[]) => {
  const message = typeof args[0] === 'string' ? args[0] : String(args[0])

  // Extract structured data from remaining args
  const metadata: Record<string, unknown> = {}
  for (let i = 1; i < args.length; i++) {
    const arg = args[i]
    if (arg && typeof arg === 'object' && !(arg instanceof Error)) {
      Object.assign(metadata, arg)
    } else if (arg instanceof Error) {
      metadata.error = { message: arg.message, stack: arg.stack, name: arg.name }
    } else {
      metadata[`arg${i}`] = arg
    }
  }

  logger.error(message, Object.keys(metadata).length > 0 ? metadata : undefined)
  origError(...args)
}
```

This preserves the structured data that vibe coders naturally pass to `console.error`.

---

## Challenge 6: API Ergonomics — Minor Friction Points

### 6a. `init()` Returns an Object, Not Separate Exports

The current pattern requires:

```ts
const deeptracer = init({ ... })
export const logger = deeptracer.logger
export const _deeptracer = deeptracer  // needed for instrumentation
```

It would be cleaner if `init()` returned everything needed for `instrumentation.ts` directly:

```ts
export const { register, onRequestError, logger } = init({ ... })
```

This already works! But the docs/examples don't show this pattern prominently. The `_deeptracer` intermediate variable confused me initially.

### 6b. `withContext()` Returns a Logger That Shares State With Parent

When you call `logger.withContext("Checkout")`, the returned logger shares `setUser()` state with the parent. Calling `setUser()` on a child context affects the parent logger and all other contexts. This is surprising and could lead to user context leaking between requests in concurrent environments.

For the integration I worked around this by passing userId directly in `captureError()` context rather than using `setUser()` on child loggers.

### 6c. Error Boundaries in Nested Routes

For `app/(app)/[businessSlug]/error.tsx`, `useDeepTracerErrorReporter(error)` works perfectly since `DeepTracerProvider` is in the root layout above it. But for `app/(app)/[businessSlug]/orders/error.tsx` and similar deeply nested error boundaries, some agents initially tried to use `useEffect + Sentry.captureException` pattern instead of the hook. The hook approach is much cleaner — just needs to be documented more prominently.

---

## Challenge 7: Package Not Designed for AI Agent Workflows

### What Happened

AI agents (like me) work by:
1. Reading documentation/types to understand the API
2. Writing code based on that understanding
3. Running builds to verify

The main friction points for AI agents specifically:

1. **No single "how to set up" doc** — I had to read `init.ts`, `route-handler.ts`, `server-action.ts`, `client.ts`, `context.tsx`, and `error-boundary.tsx` separately to understand the full API surface. A single `SETUP_GUIDE.md` would help enormously.

2. **TypeScript types don't fully document the Logger API** — `withContext()`, `forRequest()`, `startSpan()`, `addBreadcrumb()`, `setUser()`, `clearUser()`, `flush()` are all available but I had to read `core/logger.ts` implementation to discover them. Better JSDoc + a `Logger` interface with all methods explicitly listed would help.

3. **No guidance on server vs client boundary** — This is the biggest gap. The package has `@deeptracer/nextjs` (server) and `@deeptracer/nextjs/client` (React hooks/components), but there's no guidance on what to use in shared code. This caused the Challenge 3 build failures.

---

## Summary: Priority Fixes

| Priority | Issue | Impact | Fix Effort |
|----------|-------|--------|------------|
| **P0** | `@deeptracer/core` missing from nextjs deps | **Breaks every pnpm monorepo** | 1 line in package.json |
| **P1** | `withRouteHandler` drops `{ params }` | Custom wrapper needed for every project | Small type/code change |
| **P1** | No client-safe logger export | Server import in client = build crash | Add export to `/client` |
| **P1** | `global-error.tsx` silently drops errors | Most critical errors never reported | Direct HTTP fallback |
| **P2** | `captureConsole` loses structured data | Metadata flattened to string | Better arg parsing |
| **P2** | No setup guide for AI agents | Agents have to read 6 source files | One markdown file |
| **P3** | `withContext()` shared state gotcha | User context leaks between contexts | Document or isolate |

The P0 fix is literally one line. Ship it and every pnpm monorepo user can build successfully.

---

## What DeepTracer Gets Right

To be clear — DeepTracer's architecture is already significantly better than Sentry for Next.js:

1. **1-file server setup** vs Sentry's 6 files — `instrumentation.ts` does everything
2. **No `next.config.ts` modification** — Sentry's `withSentryConfig` wrapper is the #1 cause of build breaks
3. **`onRequestError` hook** — automatic server error capture without webpack injection
4. **`captureConsole: true`** — immediate safety net, catches everything even before proper migration
5. **`@deeptracer/ai` for LLM tracking** — native Vercel AI SDK wrapping with `wrapVercelAI()`
6. **Clean React integration** — `DeepTracerProvider`, `useLogger()`, `useDeepTracerErrorReporter()` all work well within the provider tree

The challenges above are fixable packaging/ergonomics issues, not architectural problems. Fix the P0 and P1 items and this becomes the most AI-agent-friendly observability SDK available.
