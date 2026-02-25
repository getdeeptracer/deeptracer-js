import type { Logger } from "@deeptracer/core"

/**
 * Wrap a Next.js Server Action with automatic tracing and error capture.
 *
 * Creates a span for the action's execution and captures any errors.
 * The original error is always re-thrown so Next.js error handling works normally.
 *
 * @param logger - DeepTracer Logger instance (from `init().logger`)
 * @param name - A descriptive name for the action. Optional — if omitted, inferred from `fn.name`.
 * @param fn - The async function to execute
 * @returns The result of the server action function
 *
 * @example
 * With explicit name:
 * ```ts
 * "use server"
 * import { withServerAction } from "@deeptracer/nextjs"
 * import { logger } from "@/instrumentation"
 *
 * export async function createUser(formData: FormData) {
 *   return withServerAction(logger, "createUser", async () => {
 *     const name = formData.get("name") as string
 *     return await db.user.create({ data: { name } })
 *   })
 * }
 * ```
 *
 * @example
 * With inferred name (uses `fn.name`):
 * ```ts
 * "use server"
 * export async function createUser(formData: FormData) {
 *   return withServerAction(logger, async function createUser() {
 *     const name = formData.get("name") as string
 *     return await db.user.create({ data: { name } })
 *   })
 * }
 * ```
 */
export async function withServerAction<T>(
  logger: Logger,
  nameOrFn: string | (() => Promise<T>),
  maybeFn?: () => Promise<T>,
): Promise<T> {
  const name = typeof nameOrFn === "string" ? nameOrFn : nameOrFn.name || "anonymous"
  const fn = typeof nameOrFn === "string" ? maybeFn! : nameOrFn

  try {
    return await logger.startSpan(`server-action:${name}`, async () => {
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
  } finally {
    await logger.flush()
  }
}
