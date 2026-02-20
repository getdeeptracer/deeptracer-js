import type { Logger } from "@deeptracer/core"

/**
 * Wrap a Next.js App Router Route Handler with automatic tracing and error capture.
 *
 * Creates a request-scoped span, extracts trace context from headers,
 * and captures any errors. The original error is re-thrown so Next.js
 * error handling works normally.
 *
 * The wrapper preserves the original handler's full signature — including
 * the `{ params }` context argument for dynamic routes. It works with
 * both Next.js 14 (sync params) and Next.js 15+ (async params).
 *
 * @param logger - DeepTracer Logger instance (from `init().logger`)
 * @param name - A descriptive name for the route (e.g., "GET /api/users")
 * @param handler - The route handler function
 * @returns A wrapped route handler with the same type signature
 *
 * @example
 * Static route (no params):
 * ```ts
 * // app/api/users/route.ts
 * import { withRouteHandler } from "@deeptracer/nextjs"
 * import { logger } from "@/instrumentation"
 *
 * export const GET = withRouteHandler(logger, "GET /api/users", async (request) => {
 *   const users = await db.user.findMany()
 *   return Response.json(users)
 * })
 * ```
 *
 * @example
 * Dynamic route with params (Next.js 15+):
 * ```ts
 * // app/api/users/[id]/route.ts
 * export const GET = withRouteHandler(
 *   logger,
 *   "GET /api/users/[id]",
 *   async (request, { params }: { params: Promise<{ id: string }> }) => {
 *     const { id } = await params
 *     const user = await db.user.findById(id)
 *     return Response.json(user)
 *   },
 * )
 * ```
 *
 * @example
 * Catch-all route:
 * ```ts
 * // app/api/[...slug]/route.ts
 * export const GET = withRouteHandler(
 *   logger,
 *   "GET /api/[...slug]",
 *   async (request, { params }: { params: Promise<{ slug: string[] }> }) => {
 *     const { slug } = await params
 *     return Response.json({ segments: slug })
 *   },
 * )
 * ```
 */
export function withRouteHandler<T extends (...args: any[]) => any>(
  logger: Logger,
  name: string,
  handler: T,
): T {
  const wrapped = async (...args: any[]) => {
    const request = args[0] as Request
    const reqLogger = logger.forRequest(request)

    return reqLogger.startSpan(`route:${name}`, async () => {
      try {
        return await handler(...args)
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

  return wrapped as unknown as T
}
