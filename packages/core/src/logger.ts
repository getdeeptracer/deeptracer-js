import type {
  LoggerConfig,
  LogLevel,
  LogEntry,
  ErrorReport,
  LLMUsageReport,
  Span,
  InactiveSpan,
  SpanData,
  User,
  Breadcrumb,
  BeforeSendEvent,
} from "./types"
import { Batcher } from "./batcher"
import { Transport } from "./transport"
import { type LoggerState, createLoggerState, addBreadcrumb as addBreadcrumbToState } from "./state"

/** Generate a random 16-character hex ID for trace/span IDs */
function generateId(): string {
  const bytes = new Uint8Array(8)
  crypto.getRandomValues(bytes)
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("")
}

/**
 * Original console methods, preserved before any interception.
 * Used internally by the Logger's debug output to avoid infinite loops
 * when captureConsole() is active.
 *
 * @internal Exported for use by @deeptracer/node and @deeptracer/browser.
 */
export const _originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
  debug: console.debug,
}

/**
 * DeepTracer Logger — lightweight observability SDK for logging, errors, tracing, and LLM usage.
 *
 * @example
 * ```ts
 * import { createLogger } from "@deeptracer/core"
 *
 * const logger = createLogger({
 *   secretKey: "dt_secret_xxx",
 *   endpoint: "https://deeptracer.example.com",
 *   product: "my-app",
 *   service: "api",
 *   environment: "production",
 * })
 *
 * logger.setUser({ id: "u_123", email: "user@example.com" })
 * logger.setTags({ release: "1.2.3" })
 * logger.info("Server started", { port: 3000 })
 * ```
 */
export class Logger {
  private batcher: Batcher
  private transport: Transport
  protected contextName?: string
  protected config: LoggerConfig
  protected state: LoggerState
  protected requestMeta?: {
    trace_id?: string
    span_id?: string
    request_id?: string
    vercel_id?: string
  }

  constructor(
    config: LoggerConfig,
    contextName?: string,
    requestMeta?: { trace_id?: string; span_id?: string; request_id?: string; vercel_id?: string },
    state?: LoggerState,
  ) {
    this.config = config
    this.contextName = contextName
    this.requestMeta = requestMeta
    this.state = state ?? createLoggerState(config.maxBreadcrumbs ?? 20)

    // Validation warnings — fail gracefully, never crash
    if (!config.secretKey && !config.publicKey) {
      _originalConsole.error(
        "[@deeptracer/core] No `secretKey` or `publicKey` provided. Events will not be authenticated.",
      )
    }
    if (!config.endpoint) {
      _originalConsole.error(
        "[@deeptracer/core] No `endpoint` provided. Events will not be sent.",
      )
    }

    this.transport = new Transport(config)
    this.batcher = new Batcher(
      { batchSize: config.batchSize, flushIntervalMs: config.flushIntervalMs },
      (entries) => {
        this.transport.sendLogs(entries)
      },
    )
  }

  // ---------------------------------------------------------------------------
  // User context
  // ---------------------------------------------------------------------------

  /**
   * Set the current user context. Attached to all subsequent logs, errors, spans, and LLM reports.
   * Shared across all child loggers (withContext, forRequest).
   *
   * @example
   * ```ts
   * logger.setUser({ id: "u_123", email: "user@example.com", plan: "pro" })
   * ```
   */
  setUser(user: User): void {
    this.state.user = user
  }

  /** Clear the current user context. */
  clearUser(): void {
    this.state.user = null
  }

  // ---------------------------------------------------------------------------
  // Tags & Context
  // ---------------------------------------------------------------------------

  /**
   * Set global tags (flat string key-values). Merged into all events' metadata as `_tags`.
   * Tags are indexed and searchable on the dashboard.
   *
   * @example
   * ```ts
   * logger.setTags({ release: "1.2.3", region: "us-east-1" })
   * ```
   */
  setTags(tags: Record<string, string>): void {
    Object.assign(this.state.tags, tags)
  }

  /** Clear all global tags. */
  clearTags(): void {
    this.state.tags = {}
  }

  /**
   * Set a named context block. Merged into metadata as `_contexts.{name}`.
   * Contexts are structured objects attached for reference (not necessarily indexed).
   *
   * @example
   * ```ts
   * logger.setContext("server", { hostname: "web-3", memory: "4gb" })
   * ```
   */
  setContext(name: string, data: Record<string, unknown>): void {
    this.state.contexts[name] = data
  }

  /** Clear a specific context block, or all contexts if no name is given. */
  clearContext(name?: string): void {
    if (name) {
      delete this.state.contexts[name]
    } else {
      this.state.contexts = {}
    }
  }

  // ---------------------------------------------------------------------------
  // Breadcrumbs
  // ---------------------------------------------------------------------------

  /**
   * Manually add a breadcrumb to the trail.
   * Breadcrumbs are also recorded automatically for every log, span, and error.
   *
   * @example
   * ```ts
   * logger.addBreadcrumb({ type: "http", message: "POST /api/checkout" })
   * ```
   */
  addBreadcrumb(breadcrumb: { type: string; message: string; timestamp?: string }): void {
    addBreadcrumbToState(this.state, {
      type: breadcrumb.type,
      message: breadcrumb.message,
      timestamp: breadcrumb.timestamp || new Date().toISOString(),
    })
  }

  // ---------------------------------------------------------------------------
  // Internal helpers
  // ---------------------------------------------------------------------------

  /** Merge user, tags, and contexts from shared state into event metadata. */
  private mergeStateMetadata(
    metadata?: Record<string, unknown>,
  ): Record<string, unknown> | undefined {
    const { user, tags, contexts } = this.state
    const hasUser = user !== null
    const hasTags = Object.keys(tags).length > 0
    const hasContexts = Object.keys(contexts).length > 0

    if (!hasUser && !hasTags && !hasContexts && !metadata) return undefined

    const result: Record<string, unknown> = { ...metadata }
    if (hasUser) result.user = user
    if (hasTags) result._tags = { ...tags }
    if (hasContexts) result._contexts = { ...contexts }
    return result
  }

  /** Run the beforeSend hook. If the hook throws, pass the event through. */
  private applyBeforeSend(event: BeforeSendEvent): BeforeSendEvent | null {
    if (!this.config.beforeSend) return event
    try {
      return this.config.beforeSend(event)
    } catch {
      return event
    }
  }

  // ---------------------------------------------------------------------------
  // Logging
  // ---------------------------------------------------------------------------

  private log(
    level: LogLevel,
    message: string,
    dataOrError?: Record<string, unknown> | unknown,
    maybeError?: unknown,
  ) {
    let metadata: Record<string, unknown> | undefined
    let error: unknown

    if (dataOrError instanceof Error) {
      error = dataOrError
    } else if (dataOrError && typeof dataOrError === "object" && !Array.isArray(dataOrError)) {
      metadata = dataOrError as Record<string, unknown>
      error = maybeError
    } else if (dataOrError !== undefined) {
      error = dataOrError
    }

    if (error instanceof Error) {
      metadata = {
        ...metadata,
        error: {
          message: error.message,
          name: error.name,
          stack: error.stack,
        },
      }
    }

    // Inject user, tags, contexts from shared state
    metadata = this.mergeStateMetadata(metadata)

    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      metadata,
      context: this.contextName,
      trace_id: this.requestMeta?.trace_id,
      span_id: this.requestMeta?.span_id,
      request_id: this.requestMeta?.request_id,
      vercel_id: this.requestMeta?.vercel_id,
    }

    // Apply beforeSend hook
    const hookResult = this.applyBeforeSend({ type: "log", data: entry })
    if (hookResult === null) return
    const finalEntry = hookResult.data as LogEntry

    if (this.config.debug) {
      const prefix = this.contextName ? `[${this.contextName}]` : ""
      const lvl = level.toUpperCase().padEnd(5)
      const consoleFn =
        level === "error"
          ? _originalConsole.error
          : level === "warn"
            ? _originalConsole.warn
            : level === "debug"
              ? _originalConsole.debug
              : _originalConsole.log
      if (finalEntry.metadata) {
        consoleFn(`${lvl} ${prefix} ${message}`, finalEntry.metadata)
      } else {
        consoleFn(`${lvl} ${prefix} ${message}`)
      }
    }

    // Record breadcrumb
    addBreadcrumbToState(this.state, {
      type: "log",
      message: `[${level}] ${message}`,
      timestamp: entry.timestamp,
    })

    this.batcher.add(finalEntry)
  }

  /** Log a debug message. */
  debug(message: string, dataOrError?: Record<string, unknown> | unknown, error?: unknown) {
    this.log("debug", message, dataOrError, error)
  }

  /** Log an informational message. */
  info(message: string, dataOrError?: Record<string, unknown> | unknown, error?: unknown) {
    this.log("info", message, dataOrError, error)
  }

  /** Log a warning. */
  warn(message: string, dataOrError?: Record<string, unknown> | unknown, error?: unknown) {
    this.log("warn", message, dataOrError, error)
  }

  /** Log an error. */
  error(message: string, dataOrError?: Record<string, unknown> | unknown, error?: unknown) {
    this.log("error", message, dataOrError, error)
  }

  // ---------------------------------------------------------------------------
  // Child loggers
  // ---------------------------------------------------------------------------

  /** Create a context-scoped logger. All logs include the context name. Shares state with parent. */
  withContext(name: string): Logger {
    return new Logger(this.config, name, this.requestMeta, this.state)
  }

  /** Create a request-scoped logger that extracts trace context from headers. Shares state with parent. */
  forRequest(request: Request): Logger {
    const vercelId = request.headers.get("x-vercel-id") || undefined
    const requestId = request.headers.get("x-request-id") || undefined
    const traceId = request.headers.get("x-trace-id") || undefined
    const spanId = request.headers.get("x-span-id") || undefined

    return new Logger(
      this.config,
      this.contextName,
      {
        trace_id: traceId,
        span_id: spanId,
        request_id: requestId || (vercelId ? vercelId.split("::").pop() : undefined),
        vercel_id: vercelId,
      },
      this.state,
    )
  }

  // ---------------------------------------------------------------------------
  // Error capture
  // ---------------------------------------------------------------------------

  /**
   * Capture and report an error immediately (not batched).
   * Automatically attaches breadcrumbs from the buffer and user context.
   */
  captureError(
    error: Error | unknown,
    context?: {
      severity?: "low" | "medium" | "high" | "critical"
      userId?: string
      context?: Record<string, unknown>
      breadcrumbs?: Breadcrumb[]
    },
  ) {
    const err = error instanceof Error ? error : new Error(String(error))

    // Record this error as a breadcrumb
    addBreadcrumbToState(this.state, {
      type: "error",
      message: err.message,
      timestamp: new Date().toISOString(),
    })

    // Merge user/tags/contexts into the error context
    const enrichedContext: Record<string, unknown> = { ...context?.context }
    if (this.state.user) enrichedContext.user = this.state.user
    if (Object.keys(this.state.tags).length > 0) enrichedContext._tags = { ...this.state.tags }
    if (Object.keys(this.state.contexts).length > 0)
      enrichedContext._contexts = { ...this.state.contexts }

    const report: ErrorReport = {
      error_message: err.message,
      stack_trace: err.stack || "",
      severity: context?.severity || "medium",
      context: Object.keys(enrichedContext).length > 0 ? enrichedContext : undefined,
      trace_id: this.requestMeta?.trace_id,
      user_id: context?.userId || this.state.user?.id,
      breadcrumbs: context?.breadcrumbs || [...this.state.breadcrumbs],
    }

    // Apply beforeSend hook
    const hookResult = this.applyBeforeSend({ type: "error", data: report })
    if (hookResult === null) return
    this.transport.sendError(hookResult.data as ErrorReport)
  }

  // ---------------------------------------------------------------------------
  // LLM usage
  // ---------------------------------------------------------------------------

  /** Track LLM usage. Sends to /ingest/llm and logs for visibility. */
  llmUsage(report: LLMUsageReport) {
    const metadata = this.mergeStateMetadata(report.metadata)

    const payload = {
      model: report.model,
      provider: report.provider,
      operation: report.operation,
      input_tokens: report.inputTokens,
      output_tokens: report.outputTokens,
      cost_usd: report.costUsd || 0,
      latency_ms: report.latencyMs,
      metadata,
    }

    // Apply beforeSend hook
    const hookResult = this.applyBeforeSend({ type: "llm", data: report })
    if (hookResult === null) return
    this.transport.sendLLMUsage(payload)

    this.log("info", `LLM call: ${report.model} (${report.operation})`, {
      llm_usage: {
        model: report.model,
        provider: report.provider,
        operation: report.operation,
        input_tokens: report.inputTokens,
        output_tokens: report.outputTokens,
        latency_ms: report.latencyMs,
      },
    })
  }

  // ---------------------------------------------------------------------------
  // Tracing
  // ---------------------------------------------------------------------------

  /** Start a span with automatic lifecycle (callback-based, recommended). */
  startSpan<T>(operation: string, fn: (span: Span) => T): T {
    const inactive = this.startInactiveSpan(operation)
    const span: Span = {
      traceId: inactive.traceId,
      spanId: inactive.spanId,
      parentSpanId: inactive.parentSpanId,
      operation: inactive.operation,
      getHeaders: () => inactive.getHeaders(),
    }

    let result: T
    try {
      result = fn(span)
    } catch (err) {
      inactive.end({ status: "error" })
      throw err
    }

    if (result instanceof Promise) {
      return result.then(
        (value) => {
          inactive.end({ status: "ok" })
          return value
        },
        (err) => {
          inactive.end({ status: "error" })
          throw err
        },
      ) as T
    }

    inactive.end({ status: "ok" })
    return result
  }

  /** Start a span with manual lifecycle. You must call span.end(). */
  startInactiveSpan(operation: string): InactiveSpan {
    const traceId = this.requestMeta?.trace_id || generateId()
    const parentSpanId = this.requestMeta?.span_id || ""
    const spanId = generateId()
    const startTime = new Date().toISOString()
    const startMs = Date.now()
    const childMeta = { ...this.requestMeta, trace_id: traceId, span_id: spanId }

    // Record breadcrumb for span start
    addBreadcrumbToState(this.state, {
      type: "function",
      message: operation,
      timestamp: startTime,
    })

    const span: InactiveSpan = {
      traceId,
      spanId,
      parentSpanId,
      operation,
      end: (options) => {
        const durationMs = Date.now() - startMs
        const spanData: SpanData = {
          trace_id: traceId,
          span_id: spanId,
          parent_span_id: parentSpanId,
          operation,
          start_time: startTime,
          duration_ms: durationMs,
          status: options?.status || "ok",
          metadata: this.mergeStateMetadata(options?.metadata),
        }

        // Apply beforeSend hook
        const hookResult = this.applyBeforeSend({ type: "trace", data: spanData })
        if (hookResult === null) return
        this.transport.sendTrace(hookResult.data as SpanData)
      },
      startSpan: <T>(childOp: string, fn: (span: Span) => T): T => {
        const childLogger = new Logger(this.config, this.contextName, childMeta, this.state)
        return childLogger.startSpan(childOp, fn)
      },
      startInactiveSpan: (childOp: string): InactiveSpan => {
        const childLogger = new Logger(this.config, this.contextName, childMeta, this.state)
        return childLogger.startInactiveSpan(childOp)
      },
      getHeaders: () => ({
        "x-trace-id": traceId,
        "x-span-id": spanId,
      }),
    }

    return span
  }

  /** Wrap a function with automatic tracing and error capture. */
  wrap<TArgs extends unknown[], TReturn>(
    operation: string,
    fn: (...args: TArgs) => TReturn,
  ): (...args: TArgs) => TReturn {
    return (...args: TArgs) => {
      return this.startSpan(operation, () => fn(...args))
    }
  }

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  /** Immediately flush all batched log entries. */
  flush() {
    this.batcher.flush()
  }

  /**
   * Stop the batch timer, flush remaining logs, and wait for in-flight requests.
   *
   * @param timeoutMs - Max time to wait for in-flight requests (default: 2000ms)
   * @returns Promise that resolves when all data is sent or timeout is reached
   *
   * @example
   * ```ts
   * await logger.destroy()
   * process.exit(0) // safe — data is confirmed sent
   * ```
   */
  async destroy(timeoutMs?: number): Promise<void> {
    await this.batcher.destroy()
    await this.transport.drain(timeoutMs)
  }
}

/** Create a new DeepTracer logger instance. */
export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config)
}
