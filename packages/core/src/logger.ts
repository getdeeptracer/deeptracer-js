import type {
  LoggerConfig,
  LogLevel,
  LogEntry,
  ErrorReport,
  LLMUsageReport,
  Span,
  InactiveSpan,
  SpanData,
} from "./types"
import { Batcher } from "./batcher"
import { Transport } from "./transport"

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
 *   product: "my-app",
 *   service: "api",
 *   environment: "production",
 *   endpoint: "https://deeptracer.example.com",
 *   apiKey: "dt_live_xxx",
 * })
 *
 * logger.info("Server started", { port: 3000 })
 * ```
 */
export class Logger {
  private batcher: Batcher
  private transport: Transport
  protected contextName?: string
  protected config: LoggerConfig
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
  ) {
    this.config = config
    this.contextName = contextName
    this.requestMeta = requestMeta
    this.transport = new Transport(config)
    this.batcher = new Batcher(
      { batchSize: config.batchSize, flushIntervalMs: config.flushIntervalMs },
      (entries) => {
        this.transport.sendLogs(entries)
      },
    )
  }

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
    } else if (
      dataOrError &&
      typeof dataOrError === "object" &&
      !Array.isArray(dataOrError)
    ) {
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
      if (metadata) {
        consoleFn(`${lvl} ${prefix} ${message}`, metadata)
      } else {
        consoleFn(`${lvl} ${prefix} ${message}`)
      }
    }

    this.batcher.add(entry)
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

  /** Create a context-scoped logger. All logs include the context name. */
  withContext(name: string): Logger {
    return new Logger(this.config, name, this.requestMeta)
  }

  /** Create a request-scoped logger that extracts trace context from headers. */
  forRequest(request: Request): Logger {
    const vercelId = request.headers.get("x-vercel-id") || undefined
    const requestId = request.headers.get("x-request-id") || undefined
    const traceId = request.headers.get("x-trace-id") || undefined
    const spanId = request.headers.get("x-span-id") || undefined

    return new Logger(this.config, this.contextName, {
      trace_id: traceId,
      span_id: spanId,
      request_id: requestId || (vercelId ? vercelId.split("::").pop() : undefined),
      vercel_id: vercelId,
    })
  }

  /** Capture and report an error immediately (not batched). */
  captureError(
    error: Error | unknown,
    context?: {
      severity?: "low" | "medium" | "high" | "critical"
      userId?: string
      context?: Record<string, unknown>
      breadcrumbs?: Array<{ type: string; message: string; timestamp: string }>
    },
  ) {
    const err = error instanceof Error ? error : new Error(String(error))
    const report: ErrorReport = {
      error_message: err.message,
      stack_trace: err.stack || "",
      severity: context?.severity || "medium",
      context: context?.context,
      trace_id: this.requestMeta?.trace_id,
      user_id: context?.userId,
      breadcrumbs: context?.breadcrumbs,
    }
    this.transport.sendError(report)
  }

  /** Track LLM usage. Sends to /ingest/llm and logs for visibility. */
  llmUsage(report: LLMUsageReport) {
    this.transport.sendLLMUsage({
      model: report.model,
      provider: report.provider,
      operation: report.operation,
      input_tokens: report.inputTokens,
      output_tokens: report.outputTokens,
      cost_usd: report.costUsd || 0,
      latency_ms: report.latencyMs,
      metadata: report.metadata,
    })

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
        (value) => { inactive.end({ status: "ok" }); return value },
        (err) => { inactive.end({ status: "error" }); throw err },
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
          metadata: options?.metadata,
        }
        this.transport.sendTrace(spanData)
      },
      startSpan: <T>(childOp: string, fn: (span: Span) => T): T => {
        const childLogger = new Logger(this.config, this.contextName, childMeta)
        return childLogger.startSpan(childOp, fn)
      },
      startInactiveSpan: (childOp: string): InactiveSpan => {
        const childLogger = new Logger(this.config, this.contextName, childMeta)
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

  /** Immediately flush all batched log entries. */
  flush() {
    this.batcher.flush()
  }

  /** Stop the batch timer and flush remaining logs. */
  destroy() {
    this.batcher.destroy()
  }
}

/** Create a new DeepTracer logger instance. */
export function createLogger(config: LoggerConfig): Logger {
  return new Logger(config)
}
