import type { Logger } from "@deeptracer/core"

/**
 * Wrap a Next.js Server Action with automatic tracing and error capture.
 *
 * Creates a span for the action's execution and captures any errors.
 * The original error is always re-thrown so Next.js error handling works normally.
 *
 * @param logger - DeepTracer Logger instance (from `init().logger`)
 * @param name - A descriptive name for the action (e.g., "createUser", "submitForm")
 * @param fn - The async function to execute
 * @returns The result of the server action function
 *
 * @example
 * ```ts
 * // app/actions.ts
 * "use server"
 * import { withServerAction } from "@deeptracer/nextjs"
 * import { logger } from "@/instrumentation"
 *
 * export async function createUser(formData: FormData) {
 *   return withServerAction(logger, "createUser", async () => {
 *     const name = formData.get("name") as string
 *     const user = await db.user.create({ data: { name } })
 *     return user
 *   })
 * }
 * ```
 */
export async function withServerAction<T>(
  logger: Logger,
  name: string,
  fn: () => Promise<T>,
): Promise<T> {
  return logger.startSpan(`server-action:${name}`, async () => {
    try {
      return await fn()
    } catch (error) {
      logger.captureError(error, {
        severity: "high",
        context: { source: "server-action", action: name },
      })
      throw error
    }
  })
}
