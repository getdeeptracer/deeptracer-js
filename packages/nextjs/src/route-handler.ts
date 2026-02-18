import type { Logger } from "@deeptracer/core"

/**
 * Wrap a Next.js App Router Route Handler with automatic tracing and error capture.
 *
 * Creates a request-scoped span, extracts trace context from headers,
 * and captures any errors. The original error is re-thrown so Next.js
 * error handling works normally.
 *
 * @param logger - DeepTracer Logger instance (from `init().logger`)
 * @param name - A descriptive name for the route (e.g., "GET /api/users")
 * @param handler - The route handler function
 * @returns A wrapped route handler function
 *
 * @example
 * ```ts
 * // app/api/users/route.ts
 * import { withRouteHandler } from "@deeptracer/nextjs"
 * import { logger } from "@/instrumentation"
 *
 * export const GET = withRouteHandler(logger, "GET /api/users", async (request) => {
 *   const users = await db.user.findMany()
 *   return Response.json(users)
 * })
 *
 * export const POST = withRouteHandler(logger, "POST /api/users", async (request) => {
 *   const body = await request.json()
 *   const user = await db.user.create({ data: body })
 *   return Response.json(user, { status: 201 })
 * })
 * ```
 */
export function withRouteHandler(
  logger: Logger,
  name: string,
  handler: (request: Request) => Promise<Response>,
): (request: Request) => Promise<Response> {
  return async (request: Request): Promise<Response> => {
    const reqLogger = logger.forRequest(request)

    return reqLogger.startSpan(`route:${name}`, async () => {
      try {
        return await handler(request)
      } catch (error) {
        reqLogger.captureError(error, {
          severity: "high",
          context: {
            source: "route-handler",
            route: name,
            method: request.method,
            url: request.url,
          },
        })
        throw error
      }
    })
  }
}
