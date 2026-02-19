import type { LoggerConfig } from "@deeptracer/core"
import { createLogger, type Logger } from "@deeptracer/core"
import { captureGlobalErrors } from "./global-errors"

/**
 * Initialize DeepTracer for Node.js/Bun with sensible defaults.
 * Creates a logger and automatically sets up global error capture.
 *
 * All config fields are optional — reads from environment variables:
 * - `DEEPTRACER_SECRET_KEY` — server API key (`dt_secret_...`)
 * - `DEEPTRACER_ENDPOINT` — ingestion API URL
 * - `DEEPTRACER_PRODUCT` — product name (default: `"unknown"`)
 * - `DEEPTRACER_SERVICE` — service name (default: `"web"`)
 * - `DEEPTRACER_ENVIRONMENT` — environment (default: `NODE_ENV` or `"production"`)
 *
 * Explicit config values override environment variables.
 *
 * @param config - Optional logger configuration (overrides env vars)
 * @returns A Logger instance with global error capture enabled
 *
 * @example
 * Zero-config (all from env vars):
 * ```ts
 * import { init } from "@deeptracer/node"
 * const logger = init()
 * ```
 *
 * @example
 * Explicit config:
 * ```ts
 * import { init } from "@deeptracer/node"
 * const logger = init({
 *   secretKey: "dt_secret_xxx",
 *   endpoint: "https://deeptracer.example.com",
 *   product: "my-app",
 * })
 * ```
 */
export function init(config?: Partial<LoggerConfig>): Logger {
  const resolved: LoggerConfig = {
    secretKey: config?.secretKey ?? process.env.DEEPTRACER_SECRET_KEY,
    endpoint: config?.endpoint ?? process.env.DEEPTRACER_ENDPOINT,
    product: config?.product ?? process.env.DEEPTRACER_PRODUCT ?? "unknown",
    service: config?.service ?? process.env.DEEPTRACER_SERVICE ?? "web",
    environment:
      config?.environment ?? process.env.DEEPTRACER_ENVIRONMENT ?? process.env.NODE_ENV ?? "production",
    batchSize: config?.batchSize,
    flushIntervalMs: config?.flushIntervalMs,
    debug: config?.debug,
    maxBreadcrumbs: config?.maxBreadcrumbs,
    beforeSend: config?.beforeSend,
  }

  if (!resolved.secretKey) {
    throw new Error(
      "[@deeptracer/node] Missing secret key. Set `DEEPTRACER_SECRET_KEY` env var or pass `secretKey` to init().",
    )
  }
  if (!resolved.endpoint) {
    throw new Error(
      "[@deeptracer/node] Missing endpoint. Set `DEEPTRACER_ENDPOINT` env var or pass `endpoint` to init().",
    )
  }

  const logger = createLogger(resolved)
  captureGlobalErrors(logger)
  return logger
}
