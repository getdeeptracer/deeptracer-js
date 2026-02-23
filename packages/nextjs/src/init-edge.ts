import {
  createLogger,
  noopLogger,
  type Logger,
  type LoggerConfig,
  type LogLevel,
} from "@deeptracer/core"

// Re-export types so the edge entry has the same public API as the node entry.
export type { NextjsConfig, InitResult } from "./init"

/**
 * Edge-safe version of `init()`. Same API as the Node.js version but without
 * OpenTelemetry auto-tracing (not supported on Edge runtime) and without
 * `process.on` global error handlers (not available on Edge).
 *
 * Logging and `onRequestError` capture work identically on both runtimes.
 */
export function init(config?: {
  captureGlobalErrors?: boolean
  captureConsole?: boolean
  autoTracing?: boolean
  tracePropagationTargets?: (string | RegExp)[]
} & Partial<LoggerConfig>): {
  register: () => void
  onRequestError: (
    err: Error,
    request: { path: string; method: string; headers: Record<string, string> },
    context: { routerKind: string; routePath: string; routeType: string },
  ) => Promise<void>
  logger: Logger
} {
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

  async function register(): Promise<void> {
    logger.info("DeepTracer initialized", {
      runtime: "edge",
      service: resolved.service,
    })
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
