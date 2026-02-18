/**
 * Configuration for creating a DeepTracer logger instance.
 *
 * @example
 * ```ts
 * const config: LoggerConfig = {
 *   product: "my-app",
 *   service: "api-server",
 *   environment: "production",
 *   endpoint: "https://deeptracer.example.com",
 *   apiKey: "dt_live_xxx",
 * }
 * ```
 */
export interface LoggerConfig {
  /** Product name (e.g., "spotbeam", "macro") */
  product: string
  /** Service name (e.g., "api", "worker", "web") */
  service: string
  /** Deployment environment */
  environment: "production" | "staging"
  /** DeepTracer ingestion endpoint URL */
  endpoint: string
  /** DeepTracer API key for authentication */
  apiKey: string
  /** Number of log entries to batch before sending. Default: 50 */
  batchSize?: number
  /** Milliseconds between automatic batch flushes. Default: 5000 */
  flushIntervalMs?: number
  /** Enable console output for all log calls (useful for local development) */
  debug?: boolean
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
 * Error report sent to DeepTracer for tracking and alerting.
 */
export interface ErrorReport {
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
