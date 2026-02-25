import {
  createLogger,
  noopLogger,
  type Logger,
  type LoggerConfig,
  type LogLevel,
} from "@deeptracer/core"
import { parseConsoleArgs } from "@deeptracer/core/internal"
import {
  DeepTracerSpanProcessor,
  isAlreadyRegistered,
  markRegistered,
  type OtelRuntime,
} from "./otel-processor"

/**
 * Configuration for the DeepTracer Next.js integration.
 * All base fields are optional — reads from environment variables.
 */
export interface NextjsConfig extends Partial<LoggerConfig> {
  /**
   * Automatically capture uncaught exceptions and unhandled rejections
   * via Node.js process events (only in Node.js runtime, not Edge).
   * Default: true
   */
  captureGlobalErrors?: boolean
  /**
   * Intercept console.log/warn/error/debug calls and forward them to DeepTracer.
   * Default: false (can be noisy in development)
   */
  captureConsole?: boolean
  /**
   * Automatically consume Next.js OpenTelemetry spans (route handlers, fetch calls,
   * renders, middleware) and forward them to DeepTracer.
   *
   * When enabled, DeepTracer registers an OpenTelemetry SpanProcessor that converts
   * all Next.js native spans into DeepTracer trace data. No per-route wrapping needed.
   *
   * Set to `false` if you have a custom OTel pipeline and only want manual
   * `withRouteHandler`/`withServerAction` tracing.
   *
   * Default: true
   */
  autoTracing?: boolean
  /**
   * URL patterns to propagate W3C trace context to (`traceparent` header).
   * By default, all outgoing fetch requests receive trace headers for
   * cross-service distributed tracing.
   *
   * Set this to restrict propagation to specific origins/patterns
   * (e.g., only your own microservices, not third-party APIs).
   *
   * Each entry can be:
   * - A string matched against the request origin (e.g., `"https://api.example.com"`)
   * - A RegExp tested against the full URL
   *
   * Only relevant when `autoTracing` is enabled and no existing OTel provider
   * (e.g., `@vercel/otel`) is detected.
   *
   * @default undefined (propagate to all URLs)
   *
   * @example
   * ```ts
   * init({
   *   tracePropagationTargets: [
   *     "https://api.myapp.com",
   *     /^https:\/\/.*\.internal\.myapp\.com/,
   *   ],
   * })
   * ```
   */
  tracePropagationTargets?: (string | RegExp)[]
}

/**
 * Return type of `init()`. Destructure `register` and `onRequestError`
 * to re-export them from your `instrumentation.ts` file.
 */
export interface InitResult {
  /**
   * Called by Next.js when the server starts.
   * Sets up global error capture, console interception, and OpenTelemetry span processing.
   * Re-export this from your `instrumentation.ts`.
   *
   * Returns a Promise — if you wrap it in a custom `register()` function,
   * make sure to `await` it so OpenTelemetry tracing and global error capture
   * are fully initialised before your server starts handling requests.
   *
   * @example
   * ```ts
   * // instrumentation.ts — custom wrapper with additional setup
   * export async function register() {
   *   await deeptracer.register()  // ← must be awaited
   *   if (process.env.NEXT_RUNTIME === "nodejs") {
   *     const { PrismaInstrumentation } = await import("@prisma/instrumentation")
   *     // register additional instrumentations...
   *   }
   * }
   * ```
   */
  register: () => Promise<void>
  /**
   * Called by Next.js on every server-side error (Server Components,
   * Route Handlers, Middleware). Captures errors and sends them to DeepTracer.
   * Re-export this as `onRequestError` from your `instrumentation.ts`.
   */
  onRequestError: (
    err: Error,
    request: { path: string; method: string; headers: Record<string, string> },
    context: { routerKind: string; routePath: string; routeType: string },
  ) => Promise<void>
  /**
   * The DeepTracer Logger instance. Use this for manual logging,
   * error capture, or to pass to `withServerAction` / `withRouteHandler`.
   *
   * @example
   * ```ts
   * const deeptracer = init()
   * export const { register, onRequestError } = deeptracer
   * export const logger = deeptracer.logger
   * ```
   */
  logger: Logger
}

/**
 * Initialize DeepTracer for Next.js. Returns `register` and `onRequestError`
 * to be re-exported from your `instrumentation.ts` file.
 *
 * All config fields are optional — reads from environment variables:
 * - `DEEPTRACER_KEY` — API key (`dt_...`)
 * - `DEEPTRACER_ENDPOINT` — ingestion API URL
 * - `DEEPTRACER_SERVICE` — service name (default: `"nextjs"`)
 * - `DEEPTRACER_ENVIRONMENT` — environment (default: `NODE_ENV` or `"production"`)
 * - `DEEPTRACER_LOG_LEVEL` — minimum log level to send (default: `"info"` in production, `"debug"` otherwise)
 *
 * Explicit config values override environment variables.
 *
 * If `apiKey` or `endpoint` is missing (no env vars, no explicit config),
 * returns **no-op stubs** — `register` and `onRequestError` do nothing,
 * `logger` is a silent no-op. This ensures `init()` never throws, so
 * `next build` succeeds even without DeepTracer env vars in CI.
 *
 * @param config - Optional configuration (overrides env vars)
 * @returns Object with `register`, `onRequestError`, and `logger` (no-op if config missing)
 *
 * @example
 * Zero-config — the entire `instrumentation.ts` file:
 * ```ts
 * import { init } from "@deeptracer/nextjs"
 * export const { register, onRequestError, logger } = init()
 * ```
 *
 * @example
 * Explicit config:
 * ```ts
 * import { init } from "@deeptracer/nextjs"
 *
 * export const { register, onRequestError } = init({
 *   apiKey: process.env.DEEPTRACER_KEY!,
 *   endpoint: "https://deeptracer.example.com",
 * })
 * ```
 */
export function init(config?: NextjsConfig): InitResult {
  const resolved: LoggerConfig = {
    apiKey: config?.apiKey ?? process.env.DEEPTRACER_KEY,
    endpoint: config?.endpoint ?? process.env.DEEPTRACER_ENDPOINT,
    service: config?.service ?? process.env.DEEPTRACER_SERVICE ?? "nextjs",
    environment:
      config?.environment ??
      process.env.DEEPTRACER_ENVIRONMENT ??
      process.env.NODE_ENV ??
      "production",
    level: config?.level ?? (process.env.DEEPTRACER_LOG_LEVEL as LogLevel | undefined),
    batchSize: config?.batchSize,
    flushIntervalMs: config?.flushIntervalMs,
    debug: config?.debug,
    maxBreadcrumbs: config?.maxBreadcrumbs,
    beforeSend: config?.beforeSend,
  }

  if (!resolved.apiKey || !resolved.endpoint) {
    console.warn(
      "[@deeptracer/nextjs] Missing API key or endpoint. Logger is disabled. " +
        "Set DEEPTRACER_KEY and DEEPTRACER_ENDPOINT env vars, or pass apiKey and endpoint to init().",
    )
    return {
      register: async () => {},
      onRequestError: async () => {},
      logger: noopLogger,
    }
  }

  const logger = createLogger(resolved)
  const shouldCaptureGlobalErrors = config?.captureGlobalErrors !== false
  const shouldCaptureConsole = config?.captureConsole === true
  const shouldAutoTrace = config?.autoTracing !== false

  async function register(): Promise<void> {
    // Auto-wire Vercel waitUntil so logs written after the HTTP response is returned
    // (e.g., from Better Auth's runInBackgroundOrAwait, Stripe webhook processing,
    // or any third-party library that defers work past the response) are not dropped
    // when Vercel freezes the function execution context.
    if (typeof process !== "undefined" && process.env.VERCEL) {
      try {
        const { waitUntil } = await import("@vercel/functions")
        resolved.waitUntil = waitUntil
      } catch {
        // @vercel/functions not installed — falls back to timer-based flushing.
        // This should not happen on Vercel where the package is always available.
      }
    }

    const runtime = typeof process !== "undefined" ? process.env?.NEXT_RUNTIME : undefined

    if (runtime === "nodejs") {
      if (shouldCaptureGlobalErrors) {
        process.on("uncaughtException", (error: Error) => {
          logger.captureError(error, {
            severity: "critical",
            context: { source: "uncaughtException", runtime: "nodejs" },
          })
          logger.flush()
        })

        process.on("unhandledRejection", (reason: unknown) => {
          logger.captureError(reason instanceof Error ? reason : new Error(String(reason)), {
            severity: "high",
            context: { source: "unhandledRejection", runtime: "nodejs" },
          })
          logger.flush()
        })
      }

      if (shouldCaptureConsole) {
        const origLog = console.log
        const origInfo = console.info
        const origWarn = console.warn
        const origError = console.error
        const origDebug = console.debug

        console.log = (...args: unknown[]) => {
          const { message, metadata } = parseConsoleArgs(args)
          logger.info(message, metadata)
          origLog(...args)
        }
        console.info = (...args: unknown[]) => {
          const { message, metadata } = parseConsoleArgs(args)
          logger.info(message, metadata)
          origInfo(...args)
        }
        console.warn = (...args: unknown[]) => {
          const { message, metadata } = parseConsoleArgs(args)
          logger.warn(message, metadata)
          origWarn(...args)
        }
        console.error = (...args: unknown[]) => {
          const { message, metadata } = parseConsoleArgs(args)
          logger.error(message, metadata)
          origError(...args)
        }
        console.debug = (...args: unknown[]) => {
          const { message, metadata } = parseConsoleArgs(args)
          logger.debug(message, metadata)
          origDebug(...args)
        }
      }

      if (shouldAutoTrace) {
        await setupOtelTracing(resolved, config?.tracePropagationTargets)
      }

      logger.info("DeepTracer initialized", {
        runtime: "nodejs",
        service: resolved.service,
        autoTracing: shouldAutoTrace,
      })
    } else if (runtime === "edge") {
      logger.info("DeepTracer initialized", {
        runtime: "edge",
        service: resolved.service,
      })
    }
  }

  async function onRequestError(
    err: Error,
    request: { path: string; method: string; headers: Record<string, string> },
    context: { routerKind: string; routePath: string; routeType: string },
  ): Promise<void> {
    const reqLogger = logger.withContext(`${context.routeType}:${context.routePath}`)

    reqLogger.addBreadcrumb({
      type: "http",
      message: `${request.method} ${request.path}`,
    })

    reqLogger.captureError(err, {
      severity: "high",
      context: {
        source: "nextjs-onRequestError",
        method: request.method,
        path: request.path,
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
      },
    })
  }

  return { register, onRequestError, logger }
}

// ---------------------------------------------------------------------------
// OTel setup — dynamic imports to avoid loading on edge runtime
// ---------------------------------------------------------------------------

async function setupOtelTracing(
  resolved: LoggerConfig,
  tracePropagationTargets?: (string | RegExp)[],
): Promise<void> {
  try {
    if (isAlreadyRegistered()) return

    // Disable Next.js built-in fetch OTel spans — we instrument globalThis.fetch
    // directly below, which avoids the UndiciInstrumentation Request-constructor patch
    // that breaks new Request(existingRequest, options) in third-party handlers.
    process.env.NEXT_OTEL_FETCH_DISABLED = "1"

    // Dynamic imports — only executed on Node.js runtime, never edge.
    // webpackIgnore tells Webpack to skip these during client-side dependency
    // analysis. Without it, Webpack walks the import graph and chokes on
    // Node.js built-ins like `diagnostics_channel` inside the OTel packages.
    // For Turbopack, the `withDeepTracer()` config wrapper adds these to
    // `serverExternalPackages` instead (see @deeptracer/nextjs/config).
    const [otelApi, otelNode, otelCore] = await Promise.all([
      import(/* webpackIgnore: true */ "@opentelemetry/api"),
      import(/* webpackIgnore: true */ "@opentelemetry/sdk-trace-node"),
      import(/* webpackIgnore: true */ "@opentelemetry/core"),
    ])

    const otelRuntime: OtelRuntime = {
      hrTimeToMilliseconds: otelCore.hrTimeToMilliseconds,
      SpanStatusCode: otelApi.SpanStatusCode,
    }

    const processor = new DeepTracerSpanProcessor(
      {
        transportConfig: {
          endpoint: resolved.endpoint,
          apiKey: resolved.apiKey,
          service: resolved.service,
          environment: resolved.environment,
        },
        beforeSend: resolved.beforeSend,
        debug: resolved.debug,
      },
      otelRuntime,
    )

    // Detect existing OTel provider (e.g., @vercel/otel)
    const currentProvider = otelApi.trace.getTracerProvider()
    const delegate = (
      currentProvider as { getDelegate?: () => Record<string, unknown> }
    )?.getDelegate?.()
    const hasExistingProvider =
      delegate != null && delegate.constructor?.name !== "NoopTracerProvider"

    if (
      hasExistingProvider &&
      typeof (delegate as { addSpanProcessor?: (p: unknown) => void }).addSpanProcessor ===
        "function"
    ) {
      // Existing provider with addSpanProcessor — just add our processor.
      // Skip undici instrumentation: the existing setup (e.g., @vercel/otel)
      // likely handles fetch instrumentation already.
      ;(delegate as { addSpanProcessor: (p: unknown) => void }).addSpanProcessor(processor)
    } else {
      // No provider or v2.x — create a new NodeTracerProvider
      if (hasExistingProvider) {
        console.warn(
          "[@deeptracer/nextjs] Existing OTel provider detected but cannot add processors. " +
            "Creating a new provider. If you need both providers, include DeepTracerSpanProcessor " +
            "in your provider's spanProcessors array.",
        )
      }

      const provider = new otelNode.NodeTracerProvider({
        spanProcessors: [processor],
      })
      provider.register()

      // Wrap globalThis.fetch to create outgoing HTTP spans and propagate W3C
      // traceparent — matching what @vercel/otel and Sentry v8 do.
      //
      // We deliberately avoid UndiciInstrumentation because it patches the global
      // Request constructor, causing:
      //   TypeError: Cannot read private member #state from an object whose class
      //   did not declare it
      // when any code does new Request(existingRequest, options) — the standard
      // copy-constructor pattern used by Better Auth, Remix adapters, and any
      // middleware that clones requests with modified headers.
      if (typeof globalThis.fetch === "function") {
        const originalFetch = globalThis.fetch.bind(globalThis)
        const ingestOrigin = new URL(resolved.endpoint!).origin
        const tracer = otelApi.trace.getTracer("@deeptracer/nextjs")

        globalThis.fetch = async function patchedFetch(
          input: Parameters<typeof globalThis.fetch>[0],
          init?: Parameters<typeof globalThis.fetch>[1],
        ): ReturnType<typeof globalThis.fetch> {
          // Determine URL and HTTP method from input
          let url: string
          let method: string
          if (typeof input === "string") {
            url = input
            method = init?.method ?? "GET"
          } else if (input instanceof URL) {
            url = input.href
            method = init?.method ?? "GET"
          } else {
            url = (input as Request).url
            method = init?.method ?? (input as Request).method ?? "GET"
          }
          method = method.toUpperCase()

          // Parse origin — skip on malformed URLs
          let origin: string
          try {
            origin = new URL(url).origin
          } catch {
            return originalFetch(input, init)
          }

          // Never instrument DeepTracer's own ingestion endpoint
          if (origin === ingestOrigin) {
            return originalFetch(input, init)
          }

          // Respect tracePropagationTargets — if set, only instrument matching URLs
          if (tracePropagationTargets && tracePropagationTargets.length > 0) {
            const matches = tracePropagationTargets.some((target) =>
              typeof target === "string"
                ? origin === target || origin.startsWith(target)
                : target.test(url),
            )
            if (!matches) {
              return originalFetch(input, init)
            }
          }

          // Create a CLIENT span for this outgoing request.
          // startActiveSpan sets this span as the active span in the async context,
          // so any nested fetch calls within the response handler will correctly
          // be recorded as children of this span.
          return tracer.startActiveSpan(
            `fetch ${method} ${new URL(url).hostname}`,
            {
              kind: otelApi.SpanKind.CLIENT,
              attributes: {
                "http.method": method,
                "http.url": url,
                "http.host": new URL(url).hostname,
              },
            },
            async (span) => {
              // Inject W3C traceparent from the CHILD span's context — not the
              // parent — so the downstream service correlates back to this call,
              // not the route handler that initiated it.
              const ctx = span.spanContext()
              const traceFlags = ctx.traceFlags.toString(16).padStart(2, "0")
              const traceparent = `00-${ctx.traceId}-${ctx.spanId}-${traceFlags}`

              // Read headers from input without reconstructing the Request object.
              // Accessing .headers on an existing Request is safe — it's a property
              // getter, not a private field. Only new Request(existingReq, ...) is
              // dangerous (the copy-constructor that triggers the #state crash).
              const existingHeaders =
                typeof input === "object" && !(input instanceof URL) && "headers" in input
                  ? (input as Request).headers
                  : init?.headers
              const mergedHeaders = new Headers(existingHeaders as HeadersInit | undefined)
              if (!mergedHeaders.has("traceparent")) {
                mergedHeaders.set("traceparent", traceparent)
              }

              try {
                const response = await originalFetch(input, { ...init, headers: mergedHeaders })
                span.setAttribute("http.status_code", response.status)
                span.setStatus({
                  code: response.ok ? otelApi.SpanStatusCode.OK : otelApi.SpanStatusCode.ERROR,
                })
                span.end()
                return response
              } catch (err) {
                span.setStatus({ code: otelApi.SpanStatusCode.ERROR })
                span.end()
                throw err
              }
            },
          )
        } as typeof globalThis.fetch
      }
    }

    markRegistered()
  } catch {
    // Fail gracefully — logging and error capture still work without OTel
    console.warn(
      "[@deeptracer/nextjs] Failed to set up OpenTelemetry auto-tracing. " +
        "Logging and error capture will still work.",
    )
  }
}
