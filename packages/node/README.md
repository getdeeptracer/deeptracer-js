# @deeptracer/node

DeepTracer SDK for **Node.js and Bun** applications. Provides automatic global error capture, console interception, and HTTP middleware for Hono and Express -- on top of the full core logging, tracing, and error tracking API.

This is the **recommended entry point** for any Node.js or Bun server. It re-exports everything from [`@deeptracer/core`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/core), so you only need to import from `@deeptracer/node`.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [init(config)](#initconfig)
  - [captureGlobalErrors(logger)](#captureglobalerrors)
  - [captureConsole(logger)](#captureconsole)
  - [honoMiddleware(logger, options?)](#honomiddleware)
  - [expressMiddleware(logger, options?)](#expressmiddleware)
  - [MiddlewareOptions](#middlewareoptions)
- [Re-exported from @deeptracer/core](#re-exported-from-deeptracercore)
- [Full Examples](#full-examples)
  - [Hono + Bun Server](#hono--bun-server)
  - [Express Server](#express-server)
  - [Background Worker](#background-worker)
- [Monorepo](#monorepo)
- [License](#license)

## Installation

```bash
npm install @deeptracer/node
```

`@deeptracer/core` is included as a dependency and does not need to be installed separately.

The package ships as both ESM and CJS with full TypeScript declarations.

## Quick Start

```ts
import { init, honoMiddleware, captureConsole } from "@deeptracer/node"
import { Hono } from "hono"

// 1. Initialize -- creates a logger and captures uncaught errors automatically
const logger = init({
  product: "my-app",
  service: "api",
  environment: "production",
  endpoint: "https://your-deeptracer.example.com",
  apiKey: "dt_live_xxx",
})

// 2. (Optional) Forward all console.* calls to DeepTracer
captureConsole(logger)

// 3. Add middleware for automatic request tracing
const app = new Hono()
app.use(honoMiddleware(logger))

app.get("/", (c) => c.text("Hello!"))

export default app
```

## API Reference

### init(config)

Initialize DeepTracer for Node.js/Bun with sensible defaults. Creates a `Logger` instance and automatically sets up global error capture via `captureGlobalErrors()`.

**This is the recommended way to set up DeepTracer.** It is equivalent to calling `createLogger(config)` followed by `captureGlobalErrors(logger)`.

```ts
import { init } from "@deeptracer/node"

const logger = init({
  product: "my-app",
  service: "api",
  environment: "production",
  endpoint: "https://your-deeptracer.example.com",
  apiKey: "dt_live_xxx",
})
```

**Parameters:**
- `config: LoggerConfig` -- Logger configuration. See [`@deeptracer/core` Configuration](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/core#configuration) for the full reference.

**Returns:** `Logger` -- A fully configured logger instance with global error capture active.

**Config quick reference:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `product` | `string` | Yes | -- | Product name (e.g., `"spotbeam"`) |
| `service` | `string` | Yes | -- | Service name (e.g., `"api"`) |
| `environment` | `"production" \| "staging"` | Yes | -- | Deployment environment |
| `endpoint` | `string` | Yes | -- | DeepTracer ingestion endpoint URL |
| `apiKey` | `string` | Yes | -- | DeepTracer API key |
| `batchSize` | `number` | No | `50` | Log entries to buffer before flushing |
| `flushIntervalMs` | `number` | No | `5000` | Milliseconds between automatic flushes |
| `debug` | `boolean` | No | `false` | Mirror all logs to local console |

---

### captureGlobalErrors(logger)

Automatically capture all uncaught exceptions and unhandled promise rejections via Node.js/Bun `process` events. Call once at application startup.

```ts
import { createLogger, captureGlobalErrors } from "@deeptracer/node"

const logger = createLogger({ /* ... */ })
captureGlobalErrors(logger)
```

**Parameters:**
- `logger: Logger` -- A DeepTracer logger instance.

**Returns:** `void`

**Behavior:**
- `process.on("uncaughtException")` -- Reports the error with severity `"critical"` and immediately flushes.
- `process.on("unhandledRejection")` -- Reports the error with severity `"high"` and immediately flushes.

Errors are sent immediately via `captureError()` (not batched) and `flush()` is called after each to ensure delivery before a potential process exit.

> **Note:** `init()` calls this automatically. You only need to call `captureGlobalErrors()` directly if you are using `createLogger()` instead of `init()`.

---

### captureConsole(logger)

Intercept all `console.log`, `console.info`, `console.warn`, `console.error`, and `console.debug` calls and forward them to DeepTracer as log entries. **Original console output is preserved** -- messages still appear in stdout/stderr as normal.

```ts
import { init, captureConsole } from "@deeptracer/node"

const logger = init({ /* ... */ })
captureConsole(logger)

// All of these now go to BOTH the console AND DeepTracer:
console.log("Server started on port 3000")
console.error("Something went wrong")
```

**Parameters:**
- `logger: Logger` -- A DeepTracer logger instance.

**Returns:** `void`

**Console method to log level mapping:**

| Console Method | DeepTracer Level |
|----------------|------------------|
| `console.log()` | `info` |
| `console.info()` | `info` |
| `console.warn()` | `warn` |
| `console.error()` | `error` |
| `console.debug()` | `debug` |

Multiple arguments are joined with spaces (e.g., `console.log("a", "b")` becomes `"a b"`).

> **Implementation note:** The original console methods are preserved internally before interception. When the logger's `debug: true` option is active, it uses the preserved originals to avoid infinite recursion.

---

### honoMiddleware(logger, options?)

Create Hono-compatible middleware that automatically instruments every HTTP request with:

- **Distributed tracing** -- creates a span per request, propagates `x-trace-id` and `x-span-id` response headers.
- **Duration tracking** -- span records total request time.
- **Trace context extraction** -- reads `x-trace-id`, `x-span-id`, `x-request-id`, and `x-vercel-id` from incoming request headers.
- **Automatic error capture** -- if the handler throws, the span ends with `status: "error"`.

```ts
import { Hono } from "hono"
import { init, honoMiddleware } from "@deeptracer/node"

const logger = init({ /* ... */ })
const app = new Hono()

// Basic usage -- traces all requests
app.use(honoMiddleware(logger))

// With options
app.use(honoMiddleware(logger, {
  ignorePaths: ["/health", "/ready", "/metrics"],
  operationName: (method, path) => `HTTP ${method} ${path}`,
}))

app.get("/api/users", async (c) => {
  // The request is already being traced by the middleware
  return c.json({ users: [] })
})
```

**Parameters:**
- `logger: Logger` -- A DeepTracer logger instance.
- `options?: MiddlewareOptions` -- Optional configuration (see [MiddlewareOptions](#middlewareoptions)).

**Returns:** A Hono middleware function `(c, next) => Promise<void>`. Pass directly to `app.use()`.

**Default span operation name:** `"{METHOD} {path}"` (e.g., `"GET /api/users"`).

---

### expressMiddleware(logger, options?)

Create Express-compatible middleware that automatically instruments every HTTP request. Same capabilities as `honoMiddleware` but for Express.

```ts
import express from "express"
import { init, expressMiddleware } from "@deeptracer/node"

const logger = init({ /* ... */ })
const app = express()

// Basic usage
app.use(expressMiddleware(logger))

// With options
app.use(expressMiddleware(logger, {
  ignorePaths: ["/health"],
}))

app.get("/api/users", (req, res) => {
  res.json({ users: [] })
})

app.listen(3000)
```

**Parameters:**
- `logger: Logger` -- A DeepTracer logger instance.
- `options?: MiddlewareOptions` -- Optional configuration (see [MiddlewareOptions](#middlewareoptions)).

**Returns:** An Express middleware function `(req, res, next) => void`. Pass directly to `app.use()`.

**Behavior details:**
- Reads trace context from incoming headers (`x-trace-id`, `x-span-id`, `x-request-id`, `x-vercel-id`).
- Sets `x-trace-id` and `x-span-id` response headers.
- Listens on the `res.on("finish")` event to end the span with the final HTTP status code.
- Status codes >= 400 result in `status: "error"` on the span.
- Span metadata includes `status_code`, `method`, and `path`.

---

### MiddlewareOptions

Configuration options shared by both `honoMiddleware` and `expressMiddleware`.

```ts
interface MiddlewareOptions {
  /** Custom function to generate the span operation name. Default: "{METHOD} {path}" */
  operationName?: (method: string, path: string) => string
  /** Paths to exclude from tracing (e.g., ["/health", "/ready"]) */
  ignorePaths?: string[]
}
```

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `operationName` | `(method: string, path: string) => string` | `` `${method} ${path}` `` | Custom operation name for the request span |
| `ignorePaths` | `string[]` | `[]` | Paths to skip tracing. Uses `startsWith` matching. |

**Examples:**

```ts
// Skip health checks and static assets
honoMiddleware(logger, {
  ignorePaths: ["/health", "/ready", "/_next/static"],
})

// Custom operation naming
honoMiddleware(logger, {
  operationName: (method, path) => {
    // Group dynamic routes: /api/users/123 -> "GET /api/users/:id"
    const normalized = path.replace(/\/[a-f0-9-]{36}/g, "/:id")
    return `${method} ${normalized}`
  },
})
```

## Re-exported from @deeptracer/core

`@deeptracer/node` re-exports the entire public API from `@deeptracer/core`. You do **not** need to install or import from `@deeptracer/core` separately.

**Functions:**
- `createLogger(config)` -- Create a logger instance (use `init()` instead for automatic global error capture)

**Logger methods** (available on the `Logger` instance returned by `init()` or `createLogger()`):
- `logger.debug(message, metadata?, error?)` -- Log a debug message
- `logger.info(message, metadata?, error?)` -- Log an info message
- `logger.warn(message, metadata?, error?)` -- Log a warning
- `logger.error(message, metadata?, error?)` -- Log an error
- `logger.captureError(error, options?)` -- Report an error immediately
- `logger.startSpan(operation, fn)` -- Callback-based tracing (auto-ends)
- `logger.startInactiveSpan(operation)` -- Manual tracing (call `.end()`)
- `logger.wrap(operation, fn)` -- Wrap a function with automatic tracing
- `logger.llmUsage(report)` -- Report LLM usage
- `logger.forRequest(request)` -- Create a request-scoped logger
- `logger.withContext(name)` -- Create a context-scoped logger
- `logger.flush()` -- Immediately flush buffered logs
- `logger.destroy()` -- Stop the batch timer and flush

**Types:**
- `LoggerConfig`, `Logger`, `LogLevel`, `LogEntry`, `ErrorReport`, `LLMUsageReport`, `Span`, `InactiveSpan`, `SpanData`, `MiddlewareOptions`

See the [`@deeptracer/core` README](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/core) for full documentation of these APIs.

## Full Examples

### Hono + Bun Server

A complete Hono server running on Bun with full DeepTracer instrumentation:

```ts
import { Hono } from "hono"
import { init, honoMiddleware, captureConsole } from "@deeptracer/node"
import { wrapVercelAI } from "@deeptracer/ai"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

// Initialize DeepTracer
const logger = init({
  product: "my-saas",
  service: "api",
  environment: "production",
  endpoint: process.env.DEEPTRACER_ENDPOINT!,
  apiKey: process.env.DEEPTRACER_API_KEY!,
  debug: process.env.NODE_ENV !== "production",
})

// Capture all console output
captureConsole(logger)

// Wrap AI SDK
const ai = wrapVercelAI(logger, { generateText })

// Create Hono app with middleware
const app = new Hono()
app.use(honoMiddleware(logger, {
  ignorePaths: ["/health"],
}))

// Health check (excluded from tracing)
app.get("/health", (c) => c.text("ok"))

// API routes
app.get("/api/summarize", async (c) => {
  const reqLogger = logger.forRequest(c.req.raw)
  const url = c.req.query("url")

  reqLogger.info("Summarization requested", { url })

  try {
    const { text } = await ai.generateText({
      model: openai("gpt-4o"),
      prompt: `Summarize: ${url}`,
    })
    return c.json({ summary: text })
  } catch (err) {
    reqLogger.captureError(err, { severity: "high", context: { url } })
    return c.json({ error: "Failed to summarize" }, 500)
  }
})

// Graceful shutdown
process.on("SIGTERM", () => {
  logger.destroy()
  process.exit(0)
})

export default {
  port: 3001,
  fetch: app.fetch,
}
```

### Express Server

A complete Express server with DeepTracer:

```ts
import express from "express"
import { init, expressMiddleware, captureConsole } from "@deeptracer/node"

const logger = init({
  product: "my-saas",
  service: "web-api",
  environment: "production",
  endpoint: process.env.DEEPTRACER_ENDPOINT!,
  apiKey: process.env.DEEPTRACER_API_KEY!,
})

captureConsole(logger)

const app = express()
app.use(express.json())
app.use(expressMiddleware(logger, {
  ignorePaths: ["/health", "/ready"],
}))

app.get("/health", (req, res) => res.send("ok"))

app.post("/api/orders", async (req, res) => {
  const orderLogger = logger.withContext("orders")

  try {
    const order = await logger.startSpan("create-order", async () => {
      orderLogger.info("Creating order", { items: req.body.items?.length })
      return createOrder(req.body)
    })

    res.json(order)
  } catch (err) {
    orderLogger.captureError(err, { severity: "high" })
    res.status(500).json({ error: "Order creation failed" })
  }
})

const server = app.listen(3000, () => {
  logger.info("Server started", { port: 3000 })
})

process.on("SIGTERM", () => {
  logger.destroy()
  server.close()
})
```

### Background Worker

A background job processor with tracing:

```ts
import { init } from "@deeptracer/node"

const logger = init({
  product: "my-saas",
  service: "worker",
  environment: "production",
  endpoint: process.env.DEEPTRACER_ENDPOINT!,
  apiKey: process.env.DEEPTRACER_API_KEY!,
})

const workerLogger = logger.withContext("job-processor")

async function processJob(job: Job) {
  await workerLogger.startSpan(`job:${job.type}`, async (span) => {
    workerLogger.info("Processing job", { jobId: job.id, type: job.type })

    // Nested span for a specific step
    await workerLogger.startSpan("send-email", async (childSpan) => {
      await sendEmail(job.payload)
    })

    workerLogger.info("Job completed", { jobId: job.id })
  })
}

// Process jobs in a loop
async function main() {
  workerLogger.info("Worker started")

  while (true) {
    try {
      const job = await getNextJob()
      if (job) await processJob(job)
      else await sleep(1000)
    } catch (err) {
      workerLogger.captureError(err, { severity: "high" })
    }
  }
}

main()
```

## Monorepo

This package is part of the [DeepTracer JavaScript SDK](https://github.com/getdeeptracer/deeptracer-js) monorepo:

| Package | Description |
|---------|-------------|
| [`@deeptracer/core`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/core) | Zero-dependency shared core |
| **`@deeptracer/node`** | Node.js/Bun SDK (this package) |
| [`@deeptracer/ai`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/ai) | AI SDK wrappers -- Vercel AI, OpenAI, Anthropic |
| [`@deeptracer/browser`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/browser) | Browser SDK (preview) |
| [`@deeptracer/react`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/react) | React integration (coming soon) |
| [`@deeptracer/nextjs`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/nextjs) | Next.js integration (coming soon) |

## License

MIT
