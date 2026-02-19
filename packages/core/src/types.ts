/**
 * Configuration for creating a DeepTracer logger instance.
 *
 * All fields are optional when environment variables are set.
 * Server packages read `DEEPTRACER_SECRET_KEY`, `DEEPTRACER_ENDPOINT`, etc.
 * Client packages read `NEXT_PUBLIC_DEEPTRACER_KEY`, `NEXT_PUBLIC_DEEPTRACER_ENDPOINT`, etc.
 *
 * @example
 * Server (Node.js / Next.js instrumentation):
 * ```ts
 * const config: LoggerConfig = {
 *   secretKey: "dt_secret_xxx",
 *   endpoint: "https://deeptracer.example.com",
 *   service: "api",
 *   environment: "production",
 * }
 * ```
 *
 * @example
 * Client (browser / React):
 * ```ts
 * const config: LoggerConfig = {
 *   publicKey: "dt_public_xxx",
 *   endpoint: "https://deeptracer.example.com",
 * }
 * ```
 */
export interface LoggerConfig {
  /** Server-side API key (prefix: `dt_secret_`). Never expose in client bundles. */
  secretKey?: string
  /** Client-side API key (prefix: `dt_public_`). Safe for browser bundles. */
  publicKey?: string
  /** Service name (e.g., "api", "worker", "web"). Default varies by package. */
  service?: string
  /** Deployment environment (any string). Default: `NODE_ENV` or `"production"` */
  environment?: string
  /** DeepTracer ingestion endpoint URL */
  endpoint?: string
  /** Number of log entries to batch before sending. Default: 50 */
  batchSize?: number
  /** Milliseconds between automatic batch flushes. Default: 5000 */
  flushIntervalMs?: number
  /**
   * Minimum log level to send to DeepTracer.
   *
   * Logs below this level are silently filtered — they won't be batched or
   * sent to the backend. Breadcrumbs are still recorded for filtered logs
   * (so error reports retain full context).
   *
   * Default: `"info"` when `environment` is `"production"`, `"debug"` otherwise.
   * Override via `DEEPTRACER_LOG_LEVEL` (server) or `NEXT_PUBLIC_DEEPTRACER_LOG_LEVEL` (client).
   */
  level?: LogLevel
  /** Enable console output for all log calls (useful for local development) */
  debug?: boolean
  /** Maximum breadcrumbs to retain for error reports. Default: 20 */
  maxBreadcrumbs?: number
  /**
   * Hook to inspect, modify, or drop events before they are sent to DeepTracer.
   * Return the event (possibly modified) to send it, or return `null` to drop it.
   *
   * @example
   * ```ts
   * beforeSend: (event) => {
   *   // Scrub PII
   *   if (event.type === "error" && event.data.context?.password) {
   *     delete event.data.context.password
   *   }
   *   // Drop health-check logs
   *   if (event.type === "log" && event.data.message.includes("/health")) {
   *     return null
   *   }
   *   return event
   * }
   * ```
   */
  beforeSend?: (event: BeforeSendEvent) => BeforeSendEvent | null
}

/** Log severity level */
export type LogLevel = "debug" | "info" | "warn" | "error"

/**
 * A single log entry sent to the DeepTracer backend.
 * Created internally by the Logger — you don't construct these manually.
 */
export interface LogEntry {
  timestamp: string
  level: LogLevel
  message: string
  metadata?: Record<string, unknown>
  trace_id?: string
  span_id?: string
  request_id?: string
  vercel_id?: string
  context?: string
}

/**
 * A breadcrumb entry — a trail of events leading up to an error.
 * Automatically captured by the SDK; also settable manually via `addBreadcrumb()`.
 *
 * Dashboard icon mapping: `http`, `db`, `function`, `user`, `error` → specific icons.
 */
export interface Breadcrumb {
  /** Activity category (http, db, function, user, error, log, or custom) */
  type: string
  /** Human-readable description (e.g., "POST /api/cart", "User loaded dashboard") */
  message: string
  /** ISO 8601 timestamp */
  timestamp: string
}

/**
 * Error report sent to DeepTracer for tracking and alerting.
 */
export interface ErrorReport {
  error_message: string
  stack_trace: string
  severity: "low" | "medium" | "high" | "critical"
  context?: Record<string, unknown>
  trace_id?: string
  user_id?: string
  breadcrumbs?: Breadcrumb[]
}

/**
 * LLM usage report for tracking AI costs and performance.
 */
export interface LLMUsageReport {
  model: string
  provider: string
  operation: string
  inputTokens: number
  outputTokens: number
  latencyMs: number
  costUsd?: number
  metadata?: Record<string, unknown>
}

/**
 * Raw span data sent to the DeepTracer backend.
 */
export interface SpanData {
  trace_id: string
  span_id: string
  parent_span_id: string
  operation: string
  start_time: string
  duration_ms: number
  status: "ok" | "error"
  metadata?: Record<string, unknown>
}

/**
 * A span representing a unit of work within a trace.
 * Returned by the callback-based `startSpan()` — lifecycle is managed automatically.
 */
export interface Span {
  /** Trace ID linking all spans in a distributed trace */
  traceId: string
  /** Unique ID for this span */
  spanId: string
  /** ID of the parent span (empty string if root span) */
  parentSpanId: string
  /** Operation name (e.g., "db-query", "fetch-user") */
  operation: string
  /** Returns headers for propagating trace context to downstream services */
  getHeaders(): Record<string, string>
}

/**
 * A span with manual lifecycle control. You must call `.end()` when done.
 */
export interface InactiveSpan extends Span {
  /** End the span and send timing data to DeepTracer */
  end(options?: { status?: "ok" | "error"; metadata?: Record<string, unknown> }): void
  /** Create a child span with callback-based lifecycle (auto-ends) */
  startSpan<T>(operation: string, fn: (span: Span) => T): T
  /** Create a child span with manual lifecycle (you must call .end()) */
  startInactiveSpan(operation: string): InactiveSpan
}

/**
 * Options for HTTP middleware (Hono, Express).
 */
export interface MiddlewareOptions {
  /** Custom function to generate the span operation name. Default: "{METHOD} {path}" */
  operationName?: (method: string, path: string) => string
  /** Paths to exclude from tracing (e.g., ["/health", "/ready"]) */
  ignorePaths?: string[]
}

/**
 * User context attached to all outgoing events.
 * Set via `logger.setUser()`, cleared via `logger.clearUser()`.
 *
 * @example
 * ```ts
 * logger.setUser({ id: "u_123", email: "user@example.com" })
 * ```
 */
export interface User {
  /** Unique user identifier (required) */
  id: string
  /** User's email address */
  email?: string
  /** Display name or username */
  username?: string
  /** Any additional user attributes */
  [key: string]: unknown
}

/**
 * Discriminated union for the `beforeSend` hook. Wraps every event type
 * so the hook can inspect and modify events before they are sent.
 */
export type BeforeSendEvent =
  | { type: "log"; data: LogEntry }
  | { type: "error"; data: ErrorReport }
  | { type: "trace"; data: SpanData }
  | { type: "llm"; data: LLMUsageReport }
