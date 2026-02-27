# @deeptracer/nextjs

[![npm](https://img.shields.io/npm/v/@deeptracer/nextjs?color=blue)](https://www.npmjs.com/package/@deeptracer/nextjs)

DeepTracer Next.js integration — automatic server-side error capture with one-file setup. The easiest way to add observability to a Next.js application.

## Installation

```bash
npm install @deeptracer/nextjs
```

**Peer dependencies:** `next >=14`, `react >=18`, `react-dom >=18`

## Quick Start (2 files, ~5 lines)

Set `DEEPTRACER_KEY` and `DEEPTRACER_ENDPOINT` in `.env.local`, then:

**1. Wrap your Next.js config:**

```ts
// next.config.ts
import { withDeepTracer } from "@deeptracer/nextjs/config"

export default withDeepTracer({
  // your existing Next.js config
})
```

**2. Create `instrumentation.ts` in your project root:**

```ts
import { init } from "@deeptracer/nextjs"
export const { register, onRequestError } = init()
```

That's it. All server-side errors are now captured automatically. `init()` reads from `DEEPTRACER_*` env vars — pass explicit config only if you need to override:

```ts
export const { register, onRequestError } = init({
  service: "web",
  apiKey: process.env.DEEPTRACER_KEY!,
  endpoint: "https://deeptracer.example.com",
})
```

Works on both **Node.js** and **Edge** runtimes. On Edge, OpenTelemetry auto-tracing is automatically disabled (Edge doesn't support Node.js built-ins). Logging and error capture work identically on both runtimes.

## Server vs Client Imports

> **This is the most common integration mistake.** `@deeptracer/nextjs` (without `/client`) includes `import "server-only"` — importing it from a `"use client"` file gives a clear build error instead of a cryptic failure.

| Context | Import From | Examples |
|---------|------------|---------|
| `instrumentation.ts`, API routes, Server Components, middleware | `@deeptracer/nextjs` | `init`, `withRouteHandler`, `withServerAction`, `Logger` |
| `"use client"` components, React hooks, browser utilities | `@deeptracer/nextjs/client` | `DeepTracerProvider`, `useLogger`, `useDeepTracerErrorReporter`, `createLogger` |
| Shared code (imported by both server and client) | `@deeptracer/nextjs/universal` | `createLogger`, `Logger`, types |

**Rules:**
- **NEVER** import `@deeptracer/nextjs` (without `/client`) from a `"use client"` file — even transitively. The build will fail with a clear `server-only` error.
- **NEVER** import a file that imports `@deeptracer/nextjs` from a `"use client"` file
- For shared code (used by both server and client): `import { createLogger } from "@deeptracer/nextjs/universal"`
- For React client code: `import { useLogger } from "@deeptracer/nextjs/client"`

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

If `apiKey` or `endpoint` is missing (no env vars, no explicit config), `init()` returns **no-op stubs** instead of throwing — `register` and `onRequestError` do nothing, `logger` is a silent no-op. This means your app builds and runs even without DeepTracer config (e.g., during `next build` in CI where env vars aren't set).

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
  apiKey: process.env.DEEPTRACER_KEY!,
})

export const { register, onRequestError } = deeptracer
export const logger = deeptracer.logger
```

---

### `withServerAction(logger, name, fn)`

Wrap a Next.js Server Action with automatic tracing and error capture. Creates a span and catches errors (re-throws after reporting). The wrapper automatically calls `await logger.flush()` after the action completes, ensuring all logs — including those from `withContext()` child loggers created inside the action — are delivered before Vercel considers the function complete.

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

Wrap a Next.js Route Handler with automatic tracing and error capture. Creates a request-scoped span, extracts trace context from incoming headers, and captures any thrown errors (re-throws after reporting so Next.js error handling still works). Automatically calls `await logger.flush()` in a `finally` block — all logs from the request, including those from `withContext()` child loggers, are guaranteed to be delivered before Vercel considers the function complete.

**Works with any handler function** — including handlers exported by third-party libraries (Auth.js, Better Auth, Stripe webhooks, etc.). If a library exports a handler, you can wrap it.

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

**Wrapping third-party handlers** (Auth.js, Better Auth, Stripe, etc.):

```ts
// app/api/auth/[...all]/route.ts
import { withRouteHandler } from "@deeptracer/nextjs"
import { logger } from "@/instrumentation"
import { GET as authGET, POST as authPOST } from "@/lib/auth" // Better Auth / Auth.js handlers

export const GET = withRouteHandler(logger, "GET /api/auth/[...all]", authGET)
export const POST = withRouteHandler(logger, "POST /api/auth/[...all]", withTrustedOrigin(authPOST))
```

This is the recommended approach — you get tracing, error capture, and guaranteed flush with one wrapper.

**Dynamic routes (Next.js 15+ async params):**

```ts
// app/api/users/[id]/route.ts
export const GET = withRouteHandler(
  logger,
  "GET /api/users/[id]",
  async (request, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params
    const user = await db.user.findById(id)
    return Response.json(user)
  },
)
```

**When you genuinely can't wrap** — if a library provides a fully-assembled Next.js handler object (e.g. `export default handler` from a framework) rather than individual `GET`/`POST` functions, use Vercel's `waitUntil` instead:

```ts
// app/api/auth/[...all]/route.ts — only if the library doesn't export individual GET/POST functions
import { waitUntil } from "@vercel/functions"
import { logger } from "@/instrumentation"
import { handlers } from "@/lib/auth"

export const GET = handlers.GET
export const POST = async (req: Request) => {
  const response = await handlers.POST(req)
  waitUntil(logger.flush()) // non-blocking — response is returned immediately
  return response
}
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
          apiKey: process.env.NEXT_PUBLIC_DEEPTRACER_KEY!,
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
- `useLogger()` — hook to access Logger from context (returns a no-op logger if no provider — safe during SSR/SSG)
- `createLogger(config)` — create a standalone Logger for `"use client"` files outside React components

### Universal exports (boundary-neutral)

For shared code imported by both server and client (analytics utilities, API clients, helpers):

```ts
import { createLogger } from "@deeptracer/nextjs/universal"

export const logger = createLogger({
  apiKey: process.env.NEXT_PUBLIC_DEEPTRACER_KEY,
  endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT,
  service: "dashboard",
})
```

No `"use client"`, no `"server-only"` — safe to import from anywhere. Exports: `createLogger`, `Logger`, and all types.

## Full Setup (Server + Client)

### 1. Next.js config

Wrap your config with `withDeepTracer()` to prevent OpenTelemetry packages from being bundled into client-side chunks:

```ts
// next.config.ts
import { withDeepTracer } from "@deeptracer/nextjs/config"

export default withDeepTracer({
  // your existing config
})
```

Works with both Webpack and Turbopack. If you use other config wrappers (e.g., Sentry), compose them:

```ts
export default withDeepTracer(withSentryConfig({ reactStrictMode: true }))
```

### 2. Environment variables

```bash
# .env.local
DEEPTRACER_KEY=dt_xxx            # Server — logger is a no-op if missing
DEEPTRACER_ENDPOINT=https://deeptracer.example.com  # Server — logger is a no-op if missing
NEXT_PUBLIC_DEEPTRACER_KEY=dt_xxx       # Client — provider warns if missing
NEXT_PUBLIC_DEEPTRACER_ENDPOINT=https://deeptracer.example.com  # Client — provider warns if missing
```

### 3. Server instrumentation (required)

```ts
// instrumentation.ts — creates logger, captures all server errors
import { init } from "@deeptracer/nextjs"

const deeptracer = init({ service: "web" })

export const { register, onRequestError } = deeptracer
export const logger = deeptracer.logger
```

`init()` reads `DEEPTRACER_KEY` and `DEEPTRACER_ENDPOINT` from env vars automatically. Pass explicit config only if you need to override.

**Custom `register()` — adding your own startup logic:**

If you need to run additional setup alongside DeepTracer (e.g., Prisma instrumentation, env validation), write your own `register()` and call `deeptracer.register()` inside it. **You must `await` it** — it's async and sets up OpenTelemetry tracing:

```ts
// instrumentation.ts — custom register wrapping deeptracer's
import { init } from "@deeptracer/nextjs"

const deeptracer = init({ service: "web" })

export const { onRequestError } = deeptracer
export const logger = deeptracer.logger

export async function register() {
  await deeptracer.register()  // ← must be awaited (async, sets up OTel + global error capture)

  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { registerInstrumentations } = await import("@opentelemetry/instrumentation")
    const { PrismaInstrumentation } = await import("@prisma/instrumentation")
    registerInstrumentations({ instrumentations: [new PrismaInstrumentation()] })
  }
}
```

Without `await`, OpenTelemetry tracing and the `globalThis.fetch` patch are set up in the background — they may not be ready when the first request arrives.

### 4. Client provider (recommended)

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

### 5. Error pages (recommended)

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

### 6. Using the server logger

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

| Variable | Side | Description |
|----------|------|-------------|
| `DEEPTRACER_KEY` | Server | API key (prefix: `dt_`). If missing, logger is a silent no-op. |
| `DEEPTRACER_ENDPOINT` | Server | Ingestion endpoint URL. If missing, logger is a silent no-op. |
| `DEEPTRACER_ENVIRONMENT` | Server | `"production"` / `"staging"` (default: `NODE_ENV`) |
| `NEXT_PUBLIC_DEEPTRACER_KEY` | Client | Same API key (needs `NEXT_PUBLIC_` prefix for Next.js client exposure) |
| `NEXT_PUBLIC_DEEPTRACER_ENDPOINT` | Client | Ingestion endpoint URL |
| `NEXT_PUBLIC_DEEPTRACER_SERVICE` | Client | Service name (default: `"web"`) |
| `NEXT_PUBLIC_DEEPTRACER_ENVIRONMENT` | Client | `"production"` / `"staging"` (default: `"production"`) |

## Common Mistakes

**Importing server code in client files:**
```ts
// BAD — build fails with "server-only" error (intentional guard)
"use client"
import { logger } from "@/instrumentation" // instrumentation.ts imports @deeptracer/nextjs (server-only)

// GOOD — use the client subpath
"use client"
import { useLogger } from "@deeptracer/nextjs/client"     // in React components
import { createLogger } from "@deeptracer/nextjs/client"   // in "use client" files outside React
```

**Shared code (imported by both server and client):**
```ts
// BAD — @deeptracer/nextjs has "server-only", @deeptracer/nextjs/client has "use client"
import { createLogger } from "@deeptracer/nextjs"         // breaks client imports
import { createLogger } from "@deeptracer/nextjs/client"   // breaks server imports

// GOOD — use the universal subpath (no directives)
import { createLogger } from "@deeptracer/nextjs/universal"
```

**Transitive server imports:**
```ts
// BAD — lib/api.ts imports from @/instrumentation, then client component imports lib/api.ts
// "use client"
// import { fetchUser } from "@/lib/api"  // lib/api.ts → @/instrumentation → @deeptracer/nextjs → CRASH

// GOOD — split server and client concerns, or use universal for shared code
// lib/api-server.ts  → imports from @/instrumentation (server-only)
// lib/api-client.ts  → uses fetch() directly or createLogger from @deeptracer/nextjs/universal
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

**Adding `@deeptracer/nextjs` to `serverExternalPackages`:**
```ts
// BAD — causes "This module cannot be imported from a Client Component" build error
const nextConfig = {
  serverExternalPackages: ["@deeptracer/nextjs", "@deeptracer/node", "@deeptracer/core"],
}

// GOOD — don't add DeepTracer packages here at all
const nextConfig = {
  serverExternalPackages: ["pg", "@clickhouse/client"], // only native/non-bundleable packages
}
```

`serverExternalPackages` is for packages with **native bindings or Node.js built-ins that webpack can't bundle** (like `pg`, `sharp`, `@clickhouse/client`). The DeepTracer SDK is pure TypeScript — it bundles correctly without any special treatment. Adding it as an external package forces it to load via native `require()` in Next.js's page data collection workers, where the `server-only` guard correctly fires because there's no webpack context. The error message (`This module cannot be imported from a Client Component`) is misleading — the real cause is the external loading context.

**Using old `secretKey`/`publicKey` fields:**
```ts
// BAD (pre-v0.5 API — no longer works)
init({ secretKey: "dt_secret_xxx", service: "web" })

// GOOD (v0.5+ API — single apiKey)
init({ apiKey: "dt_xxx", service: "web" })
```

**Thinking `withRouteHandler` only works for handlers you write:**
```ts
// WRONG assumption — withRouteHandler wraps any (Request) => Response function
// including ones exported by third-party libraries

// BAD — unnecessary boilerplate
export const POST = async (req: Request) => {
  try {
    return await authPOST(req)
  } finally {
    await logger.flush()
  }
}

// GOOD — withRouteHandler handles tracing, error capture, and flush
export const POST = withRouteHandler(logger, "POST /api/auth/[...all]", withTrustedOrigin(authPOST))
```

**Cloning a `Request` object with `new Request(existingReq, options)` crashes on Next.js 16:**
```ts
// WHY THIS CRASHES:
// Next.js 16's internal Request objects use a private #state field.
// The copy constructor (new Request(existing, options)) tries to access #state
// on an object whose class did not declare it → TypeError.
// This is true regardless of which SDK or middleware you use.

// BAD — crashes with: TypeError: Cannot read private member #state
const headers = new Headers(req.headers)
headers.set("origin", "https://example.com")
req = new Request(req, { headers })  // ← do not use the copy constructor

// GOOD — use a Proxy to override specific properties without touching #state
const headers = new Headers(req.headers)
headers.set("origin", "https://example.com")
req = new Proxy(req, {
  get(target, prop, receiver) {
    if (prop === "headers") return headers
    const value = Reflect.get(target, prop, receiver)
    return typeof value === "function" ? value.bind(target) : value
  },
})
// ↑ Intercepts .headers access without ever touching #state ✓
```

**Logs from third-party callbacks silently disappear — all logger imports must come from the same root:**
```ts
// WHY THIS HAPPENS:
// DeepTracer batches logs in memory. flush() sends whatever is in *that logger's* batch queue.
// If customer-auth.ts creates its own logger via createLogger(), it has a SEPARATE queue.
// withRouteHandler flushes *its* logger's queue — not the one customer-auth.ts is writing to.

// BAD — two separate logger instances, two separate queues, flush() misses the second one
// lib/logger.ts
import { createLogger } from "@deeptracer/core"
export const logger = createLogger({ apiKey: process.env.DEEPTRACER_KEY, ... })
// ↑ This is a DIFFERENT instance from the one in instrumentation.ts

// customer-auth.ts
import { logger } from "@/lib/logger"           // logger A's queue
const log = logger.withContext("CustomerAuth")  // shares logger A's queue
// sendOTP: log.error("...") → goes into logger A's queue

// route.ts
import { logger } from "@/instrumentation"      // logger B (from init()) — DIFFERENT INSTANCE
export const POST = withRouteHandler(logger, ...)
// flush() drains logger B's queue — logger A's queue (with sendOTP logs) is never flushed

// GOOD — single logger instance, one shared queue
// instrumentation.ts
const deeptracer = init({ service: "web" })
export const { register, onRequestError } = deeptracer
export const logger = deeptracer.logger          // the one true logger

// customer-auth.ts
import { logger } from "@/instrumentation"      // same instance
const log = logger.withContext("CustomerAuth")  // shares the same queue

// route.ts
import { logger } from "@/instrumentation"      // same instance
export const POST = withRouteHandler(logger, ...)
// flush() drains the shared queue → sendOTP logs appear in DeepTracer ✓
```

**How to diagnose silent log drops — use `debug: true`:**
```ts
// instrumentation.ts
const deeptracer = init({ debug: true })  // ← add this
export const { register, onRequestError, logger } = deeptracer

// With debug: true, every logger.info/warn/error/debug call immediately
// prints to stdout BEFORE any batching or transport.
// Check your Vercel function logs:
//   If you see:   ERROR [CustomerAuth] Failed to send OTP ...
//   → The logger IS receiving the call. Issue is in transport/config.
//
//   If you see NO output for a log you called:
//   → That logger variable is a no-op or a different instance from the one debug: true is on.
//   → Fix: ensure all logger imports trace back to the same init() call.
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
