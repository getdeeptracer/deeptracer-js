# @deeptracer/nextjs

[![npm](https://img.shields.io/npm/v/@deeptracer/nextjs?color=blue)](https://www.npmjs.com/package/@deeptracer/nextjs)

DeepTracer Next.js integration — automatic server-side error capture with one-file setup. The easiest way to add observability to a Next.js application.

## Installation

```bash
npm install @deeptracer/nextjs
```

**Peer dependencies:** `next >=14`, `react >=18`, `react-dom >=18`

## Quick Start (1 file, 3 lines)

Set `DEEPTRACER_SECRET_KEY` and `DEEPTRACER_ENDPOINT` in `.env.local`, then create `instrumentation.ts` in your project root:

```ts
import { init } from "@deeptracer/nextjs"
export const { register, onRequestError } = init()
```

That's it. All server-side errors are now captured automatically. `init()` reads from `DEEPTRACER_*` env vars — pass explicit config only if you need to override:

```ts
export const { register, onRequestError } = init({
  service: "web",
  secretKey: process.env.DEEPTRACER_SECRET_KEY!,
  endpoint: "https://deeptracer.example.com",
})
```

## Server vs Client Imports

> **This is the most common integration mistake.** Getting this wrong causes build failures.

| Context | Import From | Examples |
|---------|------------|---------|
| `instrumentation.ts`, API routes, Server Components, middleware | `@deeptracer/nextjs` | `init`, `withRouteHandler`, `withServerAction`, `Logger` |
| `"use client"` components, React hooks, browser utilities | `@deeptracer/nextjs/client` | `DeepTracerProvider`, `useLogger`, `useDeepTracerErrorReporter`, `createLogger` |

**Rules:**
- **NEVER** import `@deeptracer/nextjs` (without `/client`) from a `"use client"` file — even transitively
- **NEVER** import a file that imports `@deeptracer/nextjs` from a `"use client"` file
- For non-React client code (utility modules, localStorage helpers), use: `import { createLogger } from "@deeptracer/nextjs/client"`

## What Gets Captured Automatically

With just `instrumentation.ts`, the following are captured without any additional code:

- **Server Component errors** — rendering failures in React Server Components
- **Route Handler errors** — uncaught exceptions in `app/api/**/route.ts`
- **Middleware errors** — failures in `middleware.ts` / `proxy.ts`
- **Uncaught exceptions** — `process.on("uncaughtException")` in Node.js runtime
- **Unhandled rejections** — `process.on("unhandledRejection")` in Node.js runtime

## API Reference (Server)

Import from `@deeptracer/nextjs`:

### `init(config)`

Initialize DeepTracer for Next.js. Returns `register` and `onRequestError` for direct re-export from `instrumentation.ts`.

**Parameters:**
- `config: NextjsConfig` — extends `LoggerConfig` with:

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `captureGlobalErrors` | `boolean` | `true` | Capture uncaught exceptions and unhandled rejections via `process.on` (Node.js runtime only). |
| `captureConsole` | `boolean` | `false` | Intercept `console.*` calls and forward to DeepTracer. |

**Returns:** `{ register, onRequestError, logger }`

| Property | Type | Description |
|----------|------|-------------|
| `register` | `() => void` | Called by Next.js on server start. Sets up error handlers. |
| `onRequestError` | `(err, request, context) => Promise<void>` | Called by Next.js on every server-side error. |
| `logger` | `Logger` | The Logger instance for manual logging, server actions, and route handlers. |

```ts
// instrumentation.ts
import { init } from "@deeptracer/nextjs"

const deeptracer = init({
  service: "web",
  environment: "production",
  endpoint: "https://deeptracer.example.com",
  secretKey: process.env.DEEPTRACER_SECRET_KEY!,
})

export const { register, onRequestError } = deeptracer
export const logger = deeptracer.logger
```

---

### `withServerAction(logger, name, fn)`

Wrap a Next.js Server Action with automatic tracing and error capture. Creates a span and catches errors (re-throws after reporting).

```ts
// app/actions.ts
"use server"
import { withServerAction } from "@deeptracer/nextjs"
import { logger } from "@/instrumentation"

export async function createUser(formData: FormData) {
  return withServerAction(logger, "createUser", async () => {
    const name = formData.get("name") as string
    const user = await db.user.create({ data: { name } })
    return user
  })
}
```

---

### `withRouteHandler(logger, name, handler)`

Wrap a Next.js Route Handler with automatic tracing and error capture. Creates a request-scoped span and extracts trace context from headers.

```ts
// app/api/users/route.ts
import { withRouteHandler } from "@deeptracer/nextjs"
import { logger } from "@/instrumentation"

export const GET = withRouteHandler(logger, "GET /api/users", async (request) => {
  const users = await db.user.findMany()
  return Response.json(users)
})

export const POST = withRouteHandler(logger, "POST /api/users", async (request) => {
  const body = await request.json()
  const user = await db.user.create({ data: body })
  return Response.json(user, { status: 201 })
})
```

---

### Re-exported from @deeptracer/node

All exports from `@deeptracer/node` and `@deeptracer/core` are available:

- `createLogger`, `Logger`, `captureGlobalErrors`, `captureConsole`, `honoMiddleware`, `expressMiddleware`
- Types: `LoggerConfig`, `User`, `Breadcrumb`, `BeforeSendEvent`, `Span`, `InactiveSpan`, etc.
- Constants: `SDK_VERSION`, `SDK_NAME`

## API Reference (Client)

Import from `@deeptracer/nextjs/client`:

### `DeepTracerProvider`

React context provider for client-side error capture. Automatically captures `window.onerror` and `unhandledrejection` events.

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `config` | `LoggerConfig` | — | Logger configuration. Mutually exclusive with `logger`. |
| `logger` | `Logger` | — | Existing Logger instance. Mutually exclusive with `config`. |
| `captureErrors` | `boolean` | `true` | Capture unhandled window errors automatically. |

If neither `config` nor `logger` is provided, reads from `NEXT_PUBLIC_DEEPTRACER_*` env vars automatically (zero-config).

```tsx
// app/layout.tsx — zero-config (recommended)
import { DeepTracerProvider } from "@deeptracer/nextjs/client"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <DeepTracerProvider>
          {children}
        </DeepTracerProvider>
      </body>
    </html>
  )
}
```

```tsx
// app/layout.tsx — explicit config (if not using env vars)
import { DeepTracerProvider } from "@deeptracer/nextjs/client"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <DeepTracerProvider config={{
          service: "web",
          environment: "production",
          endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT!,
          publicKey: process.env.NEXT_PUBLIC_DEEPTRACER_KEY!,
        }}>
          {children}
        </DeepTracerProvider>
      </body>
    </html>
  )
}
```

---

### `DeepTracerErrorPage`

Drop-in error page for `error.tsx` and `global-error.tsx`. **Works without a provider** — if no `<DeepTracerProvider>` is in the tree (as in `global-error.tsx` which replaces the entire document), automatically creates a standalone logger from `NEXT_PUBLIC_DEEPTRACER_*` env vars to report the error.

```tsx
// app/error.tsx — works with the provider from layout.tsx
"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/nextjs/client"
```

```tsx
// app/global-error.tsx — works WITHOUT a provider (standalone fallback)
"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/nextjs/client"
```

---

### `useDeepTracerErrorReporter(error, severity?)`

Hook for custom error pages. Reports the error to DeepTracer while you control the UI. **Works without a provider** — falls back to env vars, safe for `global-error.tsx`.

```tsx
// app/global-error.tsx — custom UI, no provider needed
"use client"
import { useDeepTracerErrorReporter } from "@deeptracer/nextjs/client"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useDeepTracerErrorReporter(error, "critical")
  return (
    <html><body>
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </body></html>
  )
}
```

---

### Other client exports

- `DeepTracerErrorBoundary` — class-based error boundary for wrapping React trees (works without a provider)
- `useLogger()` — hook to access Logger from context (requires `DeepTracerProvider`)
- `createLogger(config)` — create a standalone Logger for non-React client code (utility modules, localStorage helpers)

## Full Setup (Server + Client)

### 1. Environment variables

```bash
# .env.local
DEEPTRACER_SECRET_KEY=dt_secret_xxx            # Server — required
DEEPTRACER_ENDPOINT=https://deeptracer.example.com  # Server — required
NEXT_PUBLIC_DEEPTRACER_KEY=dt_public_xxx       # Client — required for provider
NEXT_PUBLIC_DEEPTRACER_ENDPOINT=https://deeptracer.example.com  # Client — required for provider
```

### 2. Server instrumentation (required)

```ts
// instrumentation.ts — creates logger, captures all server errors
import { init } from "@deeptracer/nextjs"

const deeptracer = init({ service: "web" })

export const { register, onRequestError } = deeptracer
export const logger = deeptracer.logger
```

`init()` reads `DEEPTRACER_SECRET_KEY` and `DEEPTRACER_ENDPOINT` from env vars automatically. Pass explicit config only if you need to override.

### 3. Client provider (recommended)

```tsx
// app/layout.tsx — zero-config, reads NEXT_PUBLIC_DEEPTRACER_* env vars
import { DeepTracerProvider } from "@deeptracer/nextjs/client"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <DeepTracerProvider>{children}</DeepTracerProvider>
      </body>
    </html>
  )
}
```

### 4. Error pages (recommended)

```tsx
// app/error.tsx
"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/nextjs/client"
```

```tsx
// app/global-error.tsx — works without a provider
"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/nextjs/client"
```

### 5. Using the server logger

The `logger` export from `instrumentation.ts` is a full `Logger` instance for server-side code:

```ts
// Any server-side file (API routes, Server Components, server actions, lib/)
import { logger } from "@/instrumentation"

// Structured logging
logger.info("Order created", { orderId: "abc", total: 49.99 })
logger.warn("Slow query", { duration_ms: 1200, query: "SELECT ..." })

// Error tracking with severity and context
try {
  await chargeCard(orderId)
} catch (err) {
  logger.captureError(err, {
    severity: "high",
    context: { orderId, userId },
  })
}

// Scoped child logger (isolated state — safe for concurrent requests)
const checkoutLogger = logger.withContext("checkout")
checkoutLogger.info("Payment processed", { provider: "stripe" })

// User context (attached to all subsequent events from this logger)
logger.setUser({ id: user.id, email: user.email })
```

## Environment Variables

| Variable | Side | Required | Description |
|----------|------|----------|-------------|
| `DEEPTRACER_SECRET_KEY` | Server | Yes | Secret key (prefix: `dt_secret_`) |
| `DEEPTRACER_ENDPOINT` | Server | Yes | Ingestion endpoint URL |
| `DEEPTRACER_ENVIRONMENT` | Server | No | `"production"` / `"staging"` (default: `NODE_ENV`) |
| `NEXT_PUBLIC_DEEPTRACER_KEY` | Client | Yes | Public key (prefix: `dt_public_`) |
| `NEXT_PUBLIC_DEEPTRACER_ENDPOINT` | Client | Yes | Ingestion endpoint URL |
| `NEXT_PUBLIC_DEEPTRACER_SERVICE` | Client | No | Service name (default: `"web"`) |
| `NEXT_PUBLIC_DEEPTRACER_ENVIRONMENT` | Client | No | `"production"` / `"staging"` (default: `"production"`) |

## Common Mistakes

**Importing server code in client files:**
```ts
// BAD — causes build failure
"use client"
import { logger } from "@/instrumentation" // instrumentation.ts imports @deeptracer/nextjs (server-only)

// GOOD — use the client subpath
"use client"
import { useLogger } from "@deeptracer/nextjs/client"     // in React components
import { createLogger } from "@deeptracer/nextjs/client"   // in non-React client code
```

**Transitive server imports:**
```ts
// BAD — lib/api.ts imports from @/instrumentation, then client component imports lib/api.ts
// "use client"
// import { fetchUser } from "@/lib/api"  // lib/api.ts → @/instrumentation → @deeptracer/nextjs → CRASH

// GOOD — split server and client concerns into separate files
// lib/api-server.ts  → imports from @/instrumentation (server-only)
// lib/api-client.ts  → uses fetch() directly or createLogger from @deeptracer/nextjs/client
```

**Thinking global-error.tsx can't report errors:**
```tsx
// WRONG assumption — global-error.tsx replaces the entire document, so no provider...
// but DeepTracerErrorPage and useDeepTracerErrorReporter both work WITHOUT a provider.
// They automatically create a standalone logger from NEXT_PUBLIC_DEEPTRACER_* env vars.

// This WORKS — errors are reported even without a provider:
"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/nextjs/client"
```

**Using `apiKey` instead of `secretKey`/`publicKey`:**
```ts
// BAD (v0.3.x API — no longer works)
init({ apiKey: "dt_live_xxx", product: "web" })

// GOOD (v0.4.x API)
init({ secretKey: "dt_secret_xxx", service: "web" })
```

## Monorepo

This package is part of the [DeepTracer JavaScript SDK](https://github.com/getdeeptracer/deeptracer-js) monorepo:

| Package | Description |
|---------|-------------|
| [`@deeptracer/core`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/core) | Zero-dependency shared core |
| [`@deeptracer/node`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/node) | Node.js/Bun SDK |
| [`@deeptracer/ai`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/ai) | AI SDK wrappers |
| [`@deeptracer/browser`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/browser) | Browser SDK |
| [`@deeptracer/react`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/react) | React integration |
| **`@deeptracer/nextjs`** | Next.js integration (this package) |

## Links

- [deeptracer.dev](https://deeptracer.dev) — Homepage
- [Docs](https://deeptracer.dev/docs) — Documentation
- [GitHub](https://github.com/getdeeptracer/deeptracer-js) — Source code

## License

MIT
