# @deeptracer/core

Zero-dependency shared core for the [DeepTracer JavaScript SDK](https://github.com/getdeeptracer/deeptracer-js). Provides the `Logger` class with structured logging, error tracking, distributed tracing, and LLM usage monitoring.

This package is the foundation that all other `@deeptracer/*` packages build on. **Most users should install `@deeptracer/node` instead**, which re-exports everything from core and adds Node.js/Bun-specific features. Use `@deeptracer/core` directly only if you are building a custom integration or working in a runtime that is not Node.js, Bun, or a browser.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [Configuration](#configuration)
- [API Reference](#api-reference)
  - [createLogger(config)](#createloggerconfig)
  - [Logging Methods](#logging-methods)
  - [Error Tracking](#error-tracking)
  - [Distributed Tracing](#distributed-tracing)
  - [LLM Usage Tracking](#llm-usage-tracking)
  - [Request Context](#request-context)
  - [Context Scoping](#context-scoping)
  - [Lifecycle](#lifecycle)
- [Type Reference](#type-reference)
  - [LoggerConfig](#loggerconfig)
  - [LogLevel](#loglevel)
  - [LogEntry](#logentry)
  - [ErrorReport](#errorreport)
  - [LLMUsageReport](#llmusagereport)
  - [Span](#span)
  - [InactiveSpan](#inactivespan)
  - [SpanData](#spandata)
  - [MiddlewareOptions](#middlewareoptions)
- [Batching Behavior](#batching-behavior)
- [Transport](#transport)
- [Monorepo](#monorepo)
- [License](#license)

## Installation

```bash
npm install @deeptracer/core
```

The package ships as both ESM and CJS with full TypeScript declarations. Zero runtime dependencies.

## Quick Start

```ts
import { createLogger } from "@deeptracer/core"

const logger = createLogger({
  service: "api",
  environment: "production",
  endpoint: "https://your-deeptracer.example.com",
  apiKey: "dt_xxx",
})

// Structured logging (batched -- sent in groups of 50 or every 5 seconds)
logger.info("Server started", { port: 3000 })
logger.warn("Slow query", { duration_ms: 1200, query: "SELECT ..." })
logger.error("Request failed", { path: "/api/users" }, new Error("timeout"))

// Error tracking (sent immediately)
try {
  await riskyOperation()
} catch (err) {
  logger.captureError(err, { severity: "high" })
}

// Distributed tracing
const result = await logger.startSpan("fetch-user", async (span) => {
  const res = await fetch("https://api.example.com/user/1", {
    headers: span.getHeaders(), // propagate trace context
  })
  return res.json()
})

// Flush before shutdown
logger.destroy()
```

## Configuration

Pass a `LoggerConfig` object to `createLogger()`:

```ts
const logger = createLogger({
  apiKey: "dt_xxx",              // API key (reads DEEPTRACER_KEY env var if omitted)
  endpoint: "https://dt.co",     // Ingestion endpoint (reads DEEPTRACER_ENDPOINT if omitted)
  service: "api",                // Service name (default: "server")
  environment: "production",     // Deployment environment (default: NODE_ENV or "production")

  // Optional
  batchSize: 50,                 // Logs to buffer before sending (default: 50)
  flushIntervalMs: 5000,         // Max ms between flushes (default: 5000 — 200 in serverless environments, auto-detected via VERCEL or AWS_LAMBDA_FUNCTION_NAME)
  debug: false,                  // Mirror logs to console (default: false)
})
```

> **Graceful degradation:** If `apiKey` or `endpoint` is missing, `createLogger()` prints a warning and runs in local-only mode — all methods work but no data is sent. The SDK never throws on missing config.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `apiKey` | `string` | `DEEPTRACER_KEY` env var | API key (prefix: `dt_`). If missing, runs in local-only mode (no data sent). |
| `endpoint` | `string` | `DEEPTRACER_ENDPOINT` env var | DeepTracer ingestion endpoint URL. If missing, runs in local-only mode. |
| `service` | `string` | `"server"` | Service name (e.g., `"api"`, `"worker"`, `"web"`) |
| `environment` | `string` | `NODE_ENV` / `"production"` | Deployment environment |
| `batchSize` | `number` | `50` | Number of log entries to buffer before flushing |
| `flushIntervalMs` | `number` | `5000 (200 in serverless environments — auto-detected via VERCEL or AWS_LAMBDA_FUNCTION_NAME)` | Milliseconds between automatic flushes |
| `debug` | `boolean` | `false` | When `true`, all log calls also print to the console |

## API Reference

### createLogger(config)

Create a new `Logger` instance. This is the main entry point.

```ts
import { createLogger } from "@deeptracer/core"

const logger = createLogger({
  service: "api",
  environment: "production",
  endpoint: "https://your-deeptracer.example.com",
  apiKey: "dt_xxx",
})
```

**Parameters:**
- `config: LoggerConfig` -- See [Configuration](#configuration).

**Returns:** `Logger`

---

### Logging Methods

All logging methods accept the same signature:

```ts
logger.debug(message: string, metadata?: Record<string, unknown>, error?: unknown): void
logger.info(message: string, metadata?: Record<string, unknown>, error?: unknown): void
logger.warn(message: string, metadata?: Record<string, unknown>, error?: unknown): void
logger.error(message: string, metadata?: Record<string, unknown>, error?: unknown): void
```

Logs are **batched** -- they accumulate in an internal buffer and are sent to the DeepTracer backend in bulk (every 50 entries or every 5 seconds by default). This minimizes network overhead.

**Flexible argument handling:** The second argument can be either a metadata object or an Error. If it is an Error, the error details (message, name, stack) are automatically extracted into the metadata.

```ts
// Just a message
logger.info("User signed in")

// Message with structured metadata
logger.info("User signed in", { userId: "u_123", method: "oauth" })

// Message with an error (error is auto-extracted into metadata)
logger.error("Payment failed", new Error("Card declined"))

// Message with both metadata and an error
logger.error("Payment failed", { orderId: "ord_456" }, new Error("Card declined"))
```

When `debug: true` is set in the config, all log calls also print to the local console using the appropriate console method (`console.debug`, `console.log`, `console.warn`, `console.error`).

---

### Error Tracking

#### `captureError(error, options?)`

Capture and report an error **immediately** (not batched). Errors are sent to the `/ingest/errors` endpoint as soon as they occur.

```ts
logger.captureError(error: Error | unknown, options?: {
  severity?: "low" | "medium" | "high" | "critical",  // default: "medium"
  userId?: string,
  context?: Record<string, unknown>,
  breadcrumbs?: Array<{ type: string, message: string, timestamp: string }>,
}): void
```

**Examples:**

```ts
// Basic error capture
try {
  await processPayment(order)
} catch (err) {
  logger.captureError(err)
}

// With severity and context
logger.captureError(err, {
  severity: "critical",
  userId: "u_123",
  context: { orderId: "ord_456", amount: 99.99 },
})

// With breadcrumbs for debugging
logger.captureError(err, {
  severity: "high",
  breadcrumbs: [
    { type: "navigation", message: "Visited /checkout", timestamp: new Date().toISOString() },
    { type: "action", message: "Clicked 'Pay Now'", timestamp: new Date().toISOString() },
  ],
})

// Non-Error values are automatically wrapped
logger.captureError("something went wrong")  // converted to Error internally
```

If the logger was created with `forRequest()`, the `trace_id` from the request context is automatically attached to the error report.

---

### Distributed Tracing

Three ways to create spans, from simplest to most flexible:

#### `startSpan(operation, fn)` -- Callback-based (recommended)

Creates a span, runs your function inside it, and automatically ends the span when the function returns or throws. Works with both sync and async functions.

```ts
const result = await logger.startSpan("fetch-user", async (span) => {
  // span is automatically ended when this function returns
  const res = await fetch("https://api.example.com/user/1", {
    headers: span.getHeaders(), // { "x-trace-id": "...", "x-span-id": "..." }
  })
  return res.json()
})
```

If the callback throws, the span is ended with `status: "error"` and the error re-throws. If it succeeds, the span ends with `status: "ok"`.

```ts
// Sync usage
const value = logger.startSpan("compute", (span) => {
  return heavyComputation()
})

// Async usage
const data = await logger.startSpan("db-query", async (span) => {
  return db.query("SELECT * FROM users")
})
```

#### `startInactiveSpan(operation)` -- Manual lifecycle

Creates a span that you must manually end by calling `span.end()`. Useful when the span lifetime does not fit a single function scope.

```ts
const span = logger.startInactiveSpan("process-job")

try {
  await step1()
  await step2()
  span.end({ status: "ok", metadata: { steps: 2 } })
} catch (err) {
  span.end({ status: "error", metadata: { error: err.message } })
  throw err
}
```

**`InactiveSpan` methods:**

| Method | Description |
|--------|-------------|
| `end(options?)` | End the span. Options: `{ status?: "ok" \| "error", metadata?: Record<string, unknown> }` |
| `startSpan(op, fn)` | Create a child span with callback-based lifecycle |
| `startInactiveSpan(op)` | Create a child span with manual lifecycle |
| `getHeaders()` | Returns `{ "x-trace-id": "...", "x-span-id": "..." }` for propagation |

**Nested spans:**

```ts
const parent = logger.startInactiveSpan("handle-request")

// Child spans automatically inherit the parent's trace_id
await parent.startSpan("validate-input", async (span) => {
  // ...
})

const dbSpan = parent.startInactiveSpan("db-query")
await db.query("SELECT ...")
dbSpan.end()

parent.end()
```

#### `wrap(operation, fn)` -- Function decorator

Wraps an existing function so that every invocation is automatically traced. Returns a new function with the same signature.

```ts
const fetchUser = logger.wrap("fetch-user", async (id: string) => {
  const res = await fetch(`https://api.example.com/users/${id}`)
  return res.json()
})

// Every call is now traced
const user = await fetchUser("u_123")
```

#### Span Properties

Every span (both `Span` and `InactiveSpan`) has these read-only properties:

| Property | Type | Description |
|----------|------|-------------|
| `traceId` | `string` | 16-char hex ID linking all spans in a trace |
| `spanId` | `string` | 16-char hex ID unique to this span |
| `parentSpanId` | `string` | Parent span ID (empty string for root spans) |
| `operation` | `string` | Operation name passed to `startSpan()` |

#### Trace Context Propagation

Use `span.getHeaders()` to propagate trace context to downstream services:

```ts
await logger.startSpan("call-downstream", async (span) => {
  const res = await fetch("https://other-service.com/api", {
    headers: {
      ...span.getHeaders(),  // { "x-trace-id": "abc123", "x-span-id": "def456" }
      "Content-Type": "application/json",
    },
    body: JSON.stringify(data),
  })
})
```

The downstream service can then pick up the trace context via `logger.forRequest(request)`.

---

### LLM Usage Tracking

#### `llmUsage(report)`

Manually report LLM usage data. Sends to the `/ingest/llm` endpoint and also emits an info-level log for visibility.

```ts
logger.llmUsage(report: LLMUsageReport): void
```

```ts
logger.llmUsage({
  model: "gpt-4o",
  provider: "openai",
  operation: "chat.completions.create",
  inputTokens: 150,
  outputTokens: 320,
  latencyMs: 1200,
  costUsd: 0.0045,           // optional
  metadata: { userId: "u_1" }, // optional
})
```

> **Tip:** For automatic LLM tracking, use [`@deeptracer/ai`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/ai) which wraps Vercel AI SDK, OpenAI, and Anthropic clients.

---

### Request Context

#### `forRequest(request)`

Create a request-scoped logger that extracts distributed trace context from incoming HTTP headers. The returned logger attaches `trace_id`, `span_id`, `request_id`, and `vercel_id` to all subsequent logs, errors, and spans. Child loggers share the same transport as the root logger — logs from children are flushed together with the parent.

```ts
const reqLogger = logger.forRequest(request: Request): Logger
```

Headers read:
- `x-trace-id` -- distributed trace ID
- `x-span-id` -- parent span ID
- `x-request-id` -- request ID
- `x-vercel-id` -- Vercel deployment ID (also used to derive request ID)

```ts
// In a Hono route handler
app.get("/api/users", async (c) => {
  const reqLogger = logger.forRequest(c.req.raw)
  reqLogger.info("Fetching users")  // automatically includes trace_id, request_id, etc.

  const users = await reqLogger.startSpan("db-query", async () => {
    return db.query("SELECT * FROM users")
  })

  return c.json(users)
})
```

---

### Context Scoping

#### `withContext(name)`

Create a new logger that includes a context name in every log entry. Useful for distinguishing logs from different modules or subsystems. Child loggers share the same transport as the root logger — logs from children are flushed together with the parent.

```ts
const dbLogger = logger.withContext("database")
dbLogger.info("Connection pool initialized")  // context: "database"
dbLogger.warn("Slow query detected")          // context: "database"

const authLogger = logger.withContext("auth")
authLogger.info("Token refreshed")            // context: "auth"
```

---

### Lifecycle

#### `flush(): Promise<void>`

Immediately send all buffered log entries. Call this before your process exits or when you want to ensure logs are delivered.

```ts
await logger.flush()
```

#### `destroy()`

Stop the internal batch timer and flush any remaining log entries. Call this during graceful shutdown.

```ts
process.on("SIGTERM", () => {
  logger.destroy()
  process.exit(0)
})
```

> **Note on child loggers:** Calling `destroy()` on a child logger (returned by `withContext()` or `forRequest()`) flushes the shared buffer and drains in-flight requests, but does **not** stop the root logger's batch timer. Only calling `destroy()` on the root logger stops the timer.

## Type Reference

### LoggerConfig

```ts
interface LoggerConfig {
  service: string
  environment: "production" | "staging"
  endpoint: string
  apiKey: string
  batchSize?: number          // default: 50
  flushIntervalMs?: number    // default: 5000 (200 in serverless environments — auto-detected via VERCEL or AWS_LAMBDA_FUNCTION_NAME)
  debug?: boolean             // default: false
}
```

### LogLevel

```ts
type LogLevel = "debug" | "info" | "warn" | "error"
```

### LogEntry

Internal type representing a single log entry sent to the backend. You do not construct these manually.

```ts
interface LogEntry {
  timestamp: string                    // ISO 8601
  level: LogLevel
  message: string
  metadata?: Record<string, unknown>
  trace_id?: string
  span_id?: string
  request_id?: string
  vercel_id?: string
  context?: string
}
```

### ErrorReport

```ts
interface ErrorReport {
  error_message: string
  stack_trace: string
  severity: "low" | "medium" | "high" | "critical"
  context?: Record<string, unknown>
  trace_id?: string
  user_id?: string
  breadcrumbs?: Array<{
    type: string
    message: string
    timestamp: string
  }>
}
```

### LLMUsageReport

```ts
interface LLMUsageReport {
  model: string
  provider: string
  operation: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  costUsd?: number
  metadata?: Record<string, unknown>
}
```

### Span

Returned by `startSpan()`. Lifecycle is managed automatically by the callback.

```ts
interface Span {
  traceId: string
  spanId: string
  parentSpanId: string
  operation: string
  getHeaders(): Record<string, string>
}
```

### InactiveSpan

Returned by `startInactiveSpan()`. You must call `.end()` manually.

```ts
interface InactiveSpan extends Span {
  end(options?: { status?: "ok" | "error"; metadata?: Record<string, unknown> }): void
  startSpan<T>(operation: string, fn: (span: Span) => T): T
  startInactiveSpan(operation: string): InactiveSpan
}
```

### SpanData

Internal type representing the raw span payload sent to the backend.

```ts
interface SpanData {
  trace_id: string
  span_id: string
  parent_span_id: string
  operation: string
  start_time: string         // ISO 8601
  duration_ms: number
  status: "ok" | "error"
  metadata?: Record<string, unknown>
}
```

### MiddlewareOptions

Used by `honoMiddleware()` and `expressMiddleware()` in `@deeptracer/node`.

```ts
interface MiddlewareOptions {
  operationName?: (method: string, path: string) => string
  ignorePaths?: string[]
}
```

## Batching Behavior

Log entries are buffered and sent in batches to reduce network overhead:

1. Entries accumulate in an internal buffer.
2. The buffer is flushed when **either** condition is met:
   - The buffer reaches `batchSize` (default: 50 entries).
   - The flush interval timer fires (default: every 5000ms).
3. On flush, all buffered entries are sent as a single POST to `/ingest/logs`.
4. Calling `flush()` triggers an immediate flush regardless of buffer size.
5. Calling `destroy()` clears the interval timer and performs a final flush.

Error reports (`captureError`) and span data (`startSpan`, `startInactiveSpan`) are **not batched** -- they are sent immediately.

### Serverless environments (Vercel, AWS Lambda)

In serverless functions, the execution context may freeze immediately after the HTTP response is sent, before the automatic flush timer fires. DeepTracer handles this in two ways:

- **Auto-detected interval**: When `VERCEL` or `AWS_LAMBDA_FUNCTION_NAME` is set, the default `flushIntervalMs` drops to 200ms.
- **Explicit flush**: Call `await logger.flush()` before returning a response to guarantee delivery.

For third-party route handlers you can't wrap (e.g. Auth.js, Stripe webhooks), use Vercel's `waitUntil` to extend the function lifetime:

```ts
import { waitUntil } from "@vercel/functions"

export const POST = async (req: Request) => {
  const response = await thirdPartyHandler(req)
  waitUntil(logger.flush()) // extends function lifetime, non-blocking
  return response
}
```

## Transport

The transport layer sends data to four DeepTracer ingestion endpoints:

| Endpoint | Method | Data |
|----------|--------|------|
| `POST /ingest/logs` | Batched | Log entries |
| `POST /ingest/errors` | Immediate | Error reports |
| `POST /ingest/traces` | Immediate | Span data |
| `POST /ingest/llm` | Immediate | LLM usage reports |

All requests include:
- `Authorization: Bearer <apiKey>` header
- `Content-Type: application/json` header
- `service` and `environment` fields in the JSON body

If a request fails, a warning is logged to the console. The SDK does not retry failed requests -- it is designed to be non-blocking and never crash your application.

## Monorepo

This package is part of the [DeepTracer JavaScript SDK](https://github.com/getdeeptracer/deeptracer-js) monorepo:

| Package | Description |
|---------|-------------|
| **`@deeptracer/core`** | Zero-dependency shared core (this package) |
| [`@deeptracer/node`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/node) | Node.js/Bun SDK -- global errors, console capture, Hono & Express middleware |
| [`@deeptracer/ai`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/ai) | AI SDK wrappers -- Vercel AI, OpenAI, Anthropic |
| [`@deeptracer/browser`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/browser) | Browser SDK (preview) |
| [`@deeptracer/react`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/react) | React integration (coming soon) |
| [`@deeptracer/nextjs`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/nextjs) | Next.js integration (coming soon) |

## License

MIT
