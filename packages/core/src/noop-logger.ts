import type { Logger } from "./logger"

/**
 * No-op InactiveSpan — all methods are safe to call but do nothing.
 */
const NOOP_INACTIVE_SPAN = {
  traceId: "0".repeat(32),
  spanId: "0".repeat(16),
  parentSpanId: "",
  operation: "noop",
  end: () => {},
  getHeaders: () => ({}),
  startSpan: <T>(_operation: string, fn: (span: any) => T): T => fn(NOOP_SPAN),
  startInactiveSpan: () => NOOP_INACTIVE_SPAN,
}

/**
 * No-op Span — passed to startSpan callbacks.
 */
const NOOP_SPAN = {
  traceId: NOOP_INACTIVE_SPAN.traceId,
  spanId: NOOP_INACTIVE_SPAN.spanId,
  parentSpanId: NOOP_INACTIVE_SPAN.parentSpanId,
  operation: NOOP_INACTIVE_SPAN.operation,
  getHeaders: () => ({}),
}

const noop = () => {}

/**
 * A Logger-compatible object where every method is a silent no-op.
 *
 * Returned by `init()` when API key or endpoint is missing, and by
 * `useLogger()` when the DeepTracer provider hasn't initialized yet (SSR/SSG).
 *
 * This ensures the SDK never crashes your app — if config is missing,
 * all logging calls silently do nothing.
 *
 * - No timers, no Transport, no network requests, no console output
 * - `withContext()` and `forRequest()` return the same noopLogger
 * - `startSpan(op, fn)` still calls `fn` and returns its result
 * - `flush()` and `destroy()` resolve immediately
 */
export const noopLogger: Logger = {
  // Logging — silent
  debug: noop,
  info: noop,
  warn: noop,
  error: noop,

  // User context — silent
  setUser: noop,
  clearUser: noop,

  // Tags & context — silent
  setTags: noop,
  clearTags: noop,
  setContext: noop,
  clearContext: noop,

  // Breadcrumbs — silent
  addBreadcrumb: noop,

  // Child loggers — return self
  withContext: () => noopLogger,
  forRequest: () => noopLogger,

  // Error capture — silent
  captureError: noop,

  // LLM usage — silent
  llmUsage: noop,

  // Tracing — call the callback, return its result
  startSpan: <T>(_operation: string, fn: (span: any) => T): T => fn(NOOP_SPAN),
  startInactiveSpan: () => NOOP_INACTIVE_SPAN,
  wrap: <TArgs extends unknown[], TReturn>(_operation: string, fn: (...args: TArgs) => TReturn) =>
    fn,

  // Lifecycle — resolve immediately
  flush: () => Promise.resolve(),
  destroy: () => Promise.resolve(),
} as unknown as Logger
