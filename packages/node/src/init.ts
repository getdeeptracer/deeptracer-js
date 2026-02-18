import type { LoggerConfig } from "@deeptracer/core"
import { createLogger, type Logger } from "@deeptracer/core"
import { captureGlobalErrors } from "./global-errors"

/**
 * Initialize DeepTracer for Node.js/Bun with sensible defaults.
 * Creates a logger and automatically sets up global error capture.
 *
 * This is the recommended way to set up DeepTracer in a Node.js/Bun application.
 *
 * @param config - Logger configuration
 * @returns A Logger instance with global error capture enabled
 *
 * @example
 * ```ts
 * import { init } from "@deeptracer/node"
 *
 * const logger = init({
 *   product: "my-app",
 *   service: "api",
 *   environment: "production",
 *   endpoint: "https://deeptracer.example.com",
 *   apiKey: "dt_live_xxx",
 * })
 * // Global error capture is already active!
 * ```
 */
export function init(config: LoggerConfig): Logger {
  const logger = createLogger(config)
  captureGlobalErrors(logger)
  return logger
}
