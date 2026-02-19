import type { LoggerConfig, LogLevel } from "@deeptracer/core"
import { createLogger, type Logger } from "@deeptracer/core"
import { captureGlobalErrors } from "./global-errors"

/**
 * Initialize DeepTracer for Node.js/Bun with sensible defaults.
 * Creates a logger and automatically sets up global error capture.
 *
 * All config fields are optional — reads from environment variables:
 * - `DEEPTRACER_SECRET_KEY` — server API key (`dt_secret_...`)
 * - `DEEPTRACER_ENDPOINT` — ingestion API URL
 * - `DEEPTRACER_SERVICE` — service name (auto-detected: `"api"` if Hono/Express, else `"server"`)
 * - `DEEPTRACER_ENVIRONMENT` — environment (default: `NODE_ENV` or `"production"`)
 * - `DEEPTRACER_LOG_LEVEL` — minimum log level to send (default: `"info"` in production, `"debug"` otherwise)
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
 * })
 * ```
 */
/** Auto-detect service name from env var or installed frameworks. */
function detectService(): string {
  if (process.env.DEEPTRACER_SERVICE) return process.env.DEEPTRACER_SERVICE
  try {
    if (require.resolve("hono")) return "api"
  } catch {/* not installed */}
  try {
    if (require.resolve("express")) return "api"
  } catch {/* not installed */}
  return "server"
}

export function init(config?: Partial<LoggerConfig>): Logger {
  const resolved: LoggerConfig = {
    secretKey: config?.secretKey ?? process.env.DEEPTRACER_SECRET_KEY,
    endpoint: config?.endpoint ?? process.env.DEEPTRACER_ENDPOINT,
    service: config?.service ?? detectService(),
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
