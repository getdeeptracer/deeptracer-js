import type { Logger } from "@deeptracer/core"
import { _originalConsole, parseConsoleArgs } from "@deeptracer/core/internal"

/**
 * Intercept all console.log/info/warn/error/debug calls and forward them
 * to DeepTracer as log entries. Original console output is preserved.
 *
 * Structured data (objects, errors) passed to console methods is preserved
 * as metadata rather than flattened to `[object Object]`.
 *
 * @param logger - DeepTracer logger instance
 *
 * @example
 * ```ts
 * import { createLogger, captureConsole } from "@deeptracer/node"
 *
 * const logger = createLogger({ ... })
 * captureConsole(logger)
 * // console.log("user logged in", { userId: "u_123" })
 * // → DeepTracer log: message="user logged in", metadata={ userId: "u_123" }
 * ```
 */
export function captureConsole(logger: Logger): void {
  console.log = (...args: unknown[]) => {
    const { message, metadata } = parseConsoleArgs(args)
    logger.info(message, metadata)
    _originalConsole.log(...args)
  }
  console.info = (...args: unknown[]) => {
    const { message, metadata } = parseConsoleArgs(args)
    logger.info(message, metadata)
    _originalConsole.info(...args)
  }
  console.warn = (...args: unknown[]) => {
    const { message, metadata } = parseConsoleArgs(args)
    logger.warn(message, metadata)
    _originalConsole.warn(...args)
  }
  console.error = (...args: unknown[]) => {
    const { message, metadata } = parseConsoleArgs(args)
    logger.error(message, metadata)
    _originalConsole.error(...args)
  }
  console.debug = (...args: unknown[]) => {
    const { message, metadata } = parseConsoleArgs(args)
    logger.debug(message, metadata)
    _originalConsole.debug(...args)
  }
}
