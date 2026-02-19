import { createLogger, type Logger, type LoggerConfig, type LogLevel } from "@deeptracer/core"
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
   */
  register: () => void
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
 * - `DEEPTRACER_SECRET_KEY` — server API key (`dt_secret_...`)
 * - `DEEPTRACER_ENDPOINT` — ingestion API URL
 * - `DEEPTRACER_PRODUCT` — product name (default: `"unknown"`)
 * - `DEEPTRACER_SERVICE` — service name (default: `"web"`)
 * - `DEEPTRACER_ENVIRONMENT` — environment (default: `NODE_ENV` or `"production"`)
 * - `DEEPTRACER_LOG_LEVEL` — minimum log level to send (default: `"info"` in production, `"debug"` otherwise)
 *
 * Explicit config values override environment variables.
 *
 * @param config - Optional configuration (overrides env vars)
 * @returns Object with `register`, `onRequestError`, and `logger`
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
 *   secretKey: process.env.DEEPTRACER_SECRET_KEY!,
 *   endpoint: "https://deeptracer.example.com",
 *   product: "my-app",
 * })
 * ```
 */
export function init(config?: NextjsConfig): InitResult {
  const resolved: LoggerConfig = {
    secretKey: config?.secretKey ?? process.env.DEEPTRACER_SECRET_KEY,
    endpoint: config?.endpoint ?? process.env.DEEPTRACER_ENDPOINT,
    product: config?.product ?? process.env.DEEPTRACER_PRODUCT ?? "unknown",
    service: config?.service ?? process.env.DEEPTRACER_SERVICE ?? "web",
    environment:
      config?.environment ?? process.env.DEEPTRACER_ENVIRONMENT ?? process.env.NODE_ENV ?? "production",
    level: config?.level ?? (process.env.DEEPTRACER_LOG_LEVEL as LogLevel | undefined),
    batchSize: config?.batchSize,
    flushIntervalMs: config?.flushIntervalMs,
    debug: config?.debug,
    maxBreadcrumbs: config?.maxBreadcrumbs,
    beforeSend: config?.beforeSend,
  }

  if (!resolved.secretKey) {
    throw new Error(
      "[@deeptracer/nextjs] Missing secret key. Set `DEEPTRACER_SECRET_KEY` env var or pass `secretKey` to init().",
    )
  }
  if (!resolved.endpoint) {
    throw new Error(
      "[@deeptracer/nextjs] Missing endpoint. Set `DEEPTRACER_ENDPOINT` env var or pass `endpoint` to init().",
    )
  }

  const logger = createLogger(resolved)
  const shouldCaptureGlobalErrors = config?.captureGlobalErrors !== false
  const shouldCaptureConsole = config?.captureConsole === true
  const shouldAutoTrace = config?.autoTracing !== false

  async function register(): Promise<void> {
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
        await setupOtelTracing(resolved)
      }

      logger.info("DeepTracer initialized", {
        runtime: "nodejs",
        product: resolved.product,
        service: resolved.service,
        autoTracing: shouldAutoTrace,
      })
    } else if (runtime === "edge") {
      logger.info("DeepTracer initialized", {
        runtime: "edge",
        product: resolved.product,
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

async function setupOtelTracing(resolved: LoggerConfig): Promise<void> {
  try {
    if (isAlreadyRegistered()) return

    // Dynamic imports — only executed on Node.js runtime, never edge.
    // These packages are externalized by tsup (listed in package.json dependencies).
    const [otelApi, otelNode, otelCore] = await Promise.all([
      import("@opentelemetry/api"),
      import("@opentelemetry/sdk-trace-node"),
      import("@opentelemetry/core"),
    ])

    const otelRuntime: OtelRuntime = {
      hrTimeToMilliseconds: otelCore.hrTimeToMilliseconds,
      SpanStatusCode: otelApi.SpanStatusCode,
    }

    const processor = new DeepTracerSpanProcessor(
      {
        transportConfig: {
          endpoint: resolved.endpoint,
          secretKey: resolved.secretKey,
          publicKey: resolved.publicKey,
          product: resolved.product,
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
    const delegate = (currentProvider as { getDelegate?: () => Record<string, unknown> })
      ?.getDelegate?.()
    const hasExistingProvider =
      delegate != null && delegate.constructor?.name !== "NoopTracerProvider"

    if (
      hasExistingProvider &&
      typeof (delegate as { addSpanProcessor?: (p: unknown) => void }).addSpanProcessor ===
        "function"
    ) {
      // Existing provider with addSpanProcessor (OTel SDK v1.x or compatible)
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
