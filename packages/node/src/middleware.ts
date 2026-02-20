import type { Logger } from "@deeptracer/core"
import type { MiddlewareOptions } from "@deeptracer/core"

/**
 * Create Hono-compatible middleware that auto-instruments every request with:
 * - Distributed tracing (creates a span per request)
 * - Duration tracking
 * - HTTP status code capture
 * - Automatic error capture
 *
 * @param logger - DeepTracer logger instance
 * @param options - Optional middleware configuration
 * @returns A Hono middleware function — pass directly to `app.use()`
 *
 * @example
 * ```ts
 * import { Hono } from "hono"
 * import { createLogger, honoMiddleware } from "@deeptracer/node"
 *
 * const logger = createLogger({ ... })
 * const app = new Hono()
 * app.use(honoMiddleware(logger))
 * ```
 */
export function honoMiddleware(
  logger: Logger,
  options?: MiddlewareOptions,
): (c: any, next: () => Promise<void>) => Promise<void> {
  return async (c, next) => {
    const method: string = c.req.method
    const path: string = c.req.path

    if (options?.ignorePaths?.some((p) => path.startsWith(p))) {
      return next()
    }

    const opName = options?.operationName
      ? options.operationName(method, path)
      : `${method} ${path}`

    const reqLogger = logger.forRequest(c.req.raw)

    return reqLogger.startSpan(opName, async (span) => {
      c.header("x-trace-id", span.traceId)
      c.header("x-span-id", span.spanId)
      await next()
    })
  }
}

/**
 * Create Express-compatible middleware that auto-instruments every request.
 *
 * @param logger - DeepTracer logger instance
 * @param options - Optional middleware configuration
 * @returns An Express middleware function — pass directly to `app.use()`
 *
 * @example
 * ```ts
 * import express from "express"
 * import { createLogger, expressMiddleware } from "@deeptracer/node"
 *
 * const logger = createLogger({ ... })
 * const app = express()
 * app.use(expressMiddleware(logger))
 * ```
 */
export function expressMiddleware(
  logger: Logger,
  options?: MiddlewareOptions,
): (req: any, res: any, next: () => void) => void {
  return (req, res, next) => {
    const method: string = req.method
    const path: string = req.path || req.url

    if (options?.ignorePaths?.some((p) => path.startsWith(p))) {
      return next()
    }

    const opName = options?.operationName
      ? options.operationName(method, path)
      : `${method} ${path}`

    // Build a Request-like object for forRequest() to extract trace context
    const headers = new Headers()
    for (const [key, value] of Object.entries(req.headers)) {
      if (typeof value === "string") headers.set(key, value)
      else if (Array.isArray(value)) value.forEach((v) => headers.append(key, v))
    }
    const reqLogger = logger.forRequest(
      new Request(`http://${req.headers.host || "localhost"}${req.url}`, {
        method: req.method,
        headers,
      }),
    )

    const span = reqLogger.startInactiveSpan(opName)

    res.setHeader("x-trace-id", span.traceId)
    res.setHeader("x-span-id", span.spanId)

    res.on("finish", () => {
      const status = res.statusCode >= 400 ? "error" : "ok"
      span.end({
        status: status as "ok" | "error",
        metadata: { status_code: res.statusCode, method, path },
      })
    })

    next()
  }
}
