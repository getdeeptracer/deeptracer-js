import type { Logger } from "@deeptracer/core"

/**
 * Automatically capture all uncaught exceptions and unhandled promise rejections
 * via Node.js/Bun process events. Call once at application startup.
 *
 * Uncaught exceptions are reported with severity "critical".
 * Unhandled rejections are reported with severity "high".
 * Errors are flushed immediately to ensure delivery before process exit.
 *
 * @param logger - DeepTracer logger instance
 *
 * @example
 * ```ts
 * import { createLogger, captureGlobalErrors } from "@deeptracer/node"
 *
 * const logger = createLogger({ ... })
 * captureGlobalErrors(logger)
 * // All uncaught errors now automatically sent to DeepTracer
 * ```
 */
export function captureGlobalErrors(logger: Logger): void {
  process.on("uncaughtException", (error: Error) => {
    logger.captureError(error, { severity: "critical" })
    logger.flush()
  })

  process.on("unhandledRejection", (reason: unknown) => {
    logger.captureError(reason instanceof Error ? reason : new Error(String(reason)), {
      severity: "high",
    })
    logger.flush()
  })
}
