import type { Logger } from "@deeptracer/core"
import { _originalConsole } from "@deeptracer/core/internal"

/**
 * Intercept all console.log/info/warn/error/debug calls and forward them
 * to DeepTracer as log entries. Original console output is preserved.
 *
 * @param logger - DeepTracer logger instance
 *
 * @example
 * ```ts
 * import { createLogger, captureConsole } from "@deeptracer/browser"
 *
 * const logger = createLogger({ ... })
 * captureConsole(logger)
 * ```
 */
export function captureConsole(logger: Logger): void {
  console.log = (...args: unknown[]) => {
    logger.info(args.map(String).join(" "))
    _originalConsole.log(...args)
  }
  console.info = (...args: unknown[]) => {
    logger.info(args.map(String).join(" "))
    _originalConsole.info(...args)
  }
  console.warn = (...args: unknown[]) => {
    logger.warn(args.map(String).join(" "))
    _originalConsole.warn(...args)
  }
  console.error = (...args: unknown[]) => {
    logger.error(args.map(String).join(" "))
    _originalConsole.error(...args)
  }
  console.debug = (...args: unknown[]) => {
    logger.debug(args.map(String).join(" "))
    _originalConsole.debug(...args)
  }
}
