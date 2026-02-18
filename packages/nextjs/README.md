# @deeptracer/nextjs

[![npm](https://img.shields.io/npm/v/@deeptracer/nextjs?color=blue)](https://www.npmjs.com/package/@deeptracer/nextjs)

DeepTracer Next.js integration — automatic server-side error capture with one-file setup. The easiest way to add observability to a Next.js application.

## Installation

```bash
npm install @deeptracer/nextjs
```

**Peer dependencies:** `next >=14`, `react >=18`, `react-dom >=18`

## Quick Start (1 file, 5 lines)

Create `instrumentation.ts` in your project root:

```ts
import { init } from "@deeptracer/nextjs"

export const { register, onRequestError } = init({
  product: "my-app",
  service: "web",
  environment: "production",
  endpoint: "https://deeptracer.example.com",
  apiKey: process.env.DEEPTRACER_API_KEY!,
})
```

That's it. All server-side errors are now captured automatically.

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
  product: "my-app",
  service: "web",
  environment: "production",
  endpoint: "https://deeptracer.example.com",
  apiKey: process.env.DEEPTRACER_API_KEY!,
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

React context provider for client-side error capture. See [`@deeptracer/react`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/react) for full docs.

```tsx
// app/layout.tsx
import { DeepTracerProvider } from "@deeptracer/nextjs/client"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <DeepTracerProvider config={{
          product: "my-app",
          service: "web",
          environment: "production",
          endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT!,
          apiKey: process.env.NEXT_PUBLIC_DEEPTRACER_API_KEY!,
        }}>
          {children}
        </DeepTracerProvider>
      </body>
    </html>
  )
}
```

### `DeepTracerErrorPage`

Drop-in error page for `error.tsx` / `global-error.tsx`.

```tsx
// app/global-error.tsx
"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/nextjs/client"
```

### Other client exports

- `DeepTracerErrorBoundary` — class-based error boundary for wrapping React trees
- `useLogger()` — hook to access Logger from context
- `useDeepTracerErrorReporter(error)` — hook for custom error pages

## Full Setup (Server + Client)

### 1. Server-side (required)

```ts
// instrumentation.ts
import { init } from "@deeptracer/nextjs"

const deeptracer = init({
  product: "my-app",
  service: "web",
  environment: "production",
  endpoint: "https://deeptracer.example.com",
  apiKey: process.env.DEEPTRACER_API_KEY!,
})

export const { register, onRequestError } = deeptracer
export const logger = deeptracer.logger
```

### 2. Client-side provider (optional)

```tsx
// app/layout.tsx
import { DeepTracerProvider } from "@deeptracer/nextjs/client"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <DeepTracerProvider config={{
          product: "my-app",
          service: "web",
          environment: "production",
          endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT!,
          apiKey: process.env.NEXT_PUBLIC_DEEPTRACER_API_KEY!,
        }}>
          {children}
        </DeepTracerProvider>
      </body>
    </html>
  )
}
```

### 3. Error boundary (optional)

```tsx
// app/global-error.tsx
"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/nextjs/client"
```

## Environment Variables

| Variable | Side | Description |
|----------|------|-------------|
| `DEEPTRACER_API_KEY` | Server | API key for server-side SDK |
| `NEXT_PUBLIC_DEEPTRACER_ENDPOINT` | Client | Ingestion endpoint URL |
| `NEXT_PUBLIC_DEEPTRACER_API_KEY` | Client | API key for client-side SDK |
| `NEXT_PUBLIC_DEEPTRACER_PRODUCT` | Client | Product name (for zero-config provider) |
| `NEXT_PUBLIC_DEEPTRACER_SERVICE` | Client | Service name (default: `"web"`) |
| `NEXT_PUBLIC_DEEPTRACER_ENVIRONMENT` | Client | `"production"` or `"staging"` (default: `"production"`) |

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
