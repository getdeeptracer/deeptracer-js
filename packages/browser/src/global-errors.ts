import type { Logger } from "@deeptracer/core"

/**
 * Automatically capture all uncaught exceptions and unhandled promise rejections
 * via browser window events. Call once at application startup.
 *
 * Uncaught exceptions are reported with severity "critical".
 * Unhandled rejections are reported with severity "high".
 *
 * @param logger - DeepTracer logger instance
 *
 * @example
 * ```ts
 * import { createLogger, captureGlobalErrors } from "@deeptracer/browser"
 *
 * const logger = createLogger({ ... })
 * captureGlobalErrors(logger)
 * ```
 */
export function captureGlobalErrors(logger: Logger): void {
  window.addEventListener("error", (event) => {
    logger.captureError(event.error || new Error(event.message || "Unknown error"), {
      severity: "critical",
    })
  })

  window.addEventListener("unhandledrejection", (event) => {
    logger.captureError(
      event.reason instanceof Error ? event.reason : new Error(String(event.reason)),
      { severity: "high" },
    )
  })
}
