import { createLogger, type Logger, type LoggerConfig } from "@deeptracer/core"

/**
 * Configuration for the DeepTracer Next.js integration.
 * Extends the base LoggerConfig with Next.js-specific options.
 */
export interface NextjsConfig extends LoggerConfig {
  /**
   * Automatically capture uncaught exceptions and unhandled rejections
   * via Node.js process events (only in Node.js runtime, not Edge).
   * Default: true
   */
  captureGlobalErrors?: boolean
  /**
   * Intercept console.log/warn/error/debug calls and forward them to DeepTracer.
   * Default: false (can be noisy in development)
   */
  captureConsole?: boolean
}

/**
 * Return type of `init()`. Destructure `register` and `onRequestError`
 * to re-export them from your `instrumentation.ts` file.
 */
export interface InitResult {
  /**
   * Called by Next.js when the server starts.
   * Sets up global error capture and console interception.
   * Re-export this from your `instrumentation.ts`.
   */
  register: () => void
  /**
   * Called by Next.js on every server-side error (Server Components,
   * Route Handlers, Middleware). Captures errors and sends them to DeepTracer.
   * Re-export this as `onRequestError` from your `instrumentation.ts`.
   */
  onRequestError: (
    err: Error,
    request: { path: string; method: string; headers: Record<string, string> },
    context: { routerKind: string; routePath: string; routeType: string },
  ) => Promise<void>
  /**
   * The DeepTracer Logger instance. Use this for manual logging,
   * error capture, or to pass to `withServerAction` / `withRouteHandler`.
   *
   * @example
   * ```ts
   * const deeptracer = init({ ... })
   * export const { register, onRequestError } = deeptracer
   * export const logger = deeptracer.logger
   * ```
   */
  logger: Logger
}

/**
 * Initialize DeepTracer for Next.js. Returns `register` and `onRequestError`
 * to be re-exported from your `instrumentation.ts` file.
 *
 * This is the **only setup required** for server-side error capture in Next.js.
 * Every server-side error (Server Components, Route Handlers, Middleware) is
 * automatically captured via Next.js's built-in `onRequestError` hook.
 *
 * @param config - Logger configuration with optional Next.js-specific options
 * @returns Object with `register`, `onRequestError`, and `logger`
 *
 * @example
 * Create `instrumentation.ts` in your project root:
 * ```ts
 * import { init } from "@deeptracer/nextjs"
 *
 * export const { register, onRequestError } = init({
 *   product: "my-app",
 *   service: "web",
 *   environment: "production",
 *   endpoint: "https://deeptracer.example.com",
 *   apiKey: process.env.DEEPTRACER_API_KEY!,
 * })
 * ```
 *
 * That's it. All server-side errors are now captured automatically.
 */
export function init(config: NextjsConfig): InitResult {
  const logger = createLogger(config)
  const shouldCaptureGlobalErrors = config.captureGlobalErrors !== false
  const shouldCaptureConsole = config.captureConsole === true

  function register(): void {
    const runtime =
      typeof process !== "undefined" ? process.env?.NEXT_RUNTIME : undefined

    if (runtime === "nodejs") {
      if (shouldCaptureGlobalErrors) {
        process.on("uncaughtException", (error: Error) => {
          logger.captureError(error, {
            severity: "critical",
            context: { source: "uncaughtException", runtime: "nodejs" },
          })
          logger.flush()
        })

        process.on("unhandledRejection", (reason: unknown) => {
          logger.captureError(
            reason instanceof Error ? reason : new Error(String(reason)),
            {
              severity: "high",
              context: { source: "unhandledRejection", runtime: "nodejs" },
            },
          )
          logger.flush()
        })
      }

      if (shouldCaptureConsole) {
        const origLog = console.log
        const origInfo = console.info
        const origWarn = console.warn
        const origError = console.error
        const origDebug = console.debug

        console.log = (...args: unknown[]) => {
          logger.info(args.map(String).join(" "))
          origLog(...args)
        }
        console.info = (...args: unknown[]) => {
          logger.info(args.map(String).join(" "))
          origInfo(...args)
        }
        console.warn = (...args: unknown[]) => {
          logger.warn(args.map(String).join(" "))
          origWarn(...args)
        }
        console.error = (...args: unknown[]) => {
          logger.error(args.map(String).join(" "))
          origError(...args)
        }
        console.debug = (...args: unknown[]) => {
          logger.debug(args.map(String).join(" "))
          origDebug(...args)
        }
      }

      logger.info("DeepTracer initialized", {
        runtime: "nodejs",
        product: config.product,
        service: config.service,
      })
    } else if (runtime === "edge") {
      logger.info("DeepTracer initialized", {
        runtime: "edge",
        product: config.product,
        service: config.service,
      })
    }
  }

  async function onRequestError(
    err: Error,
    request: { path: string; method: string; headers: Record<string, string> },
    context: { routerKind: string; routePath: string; routeType: string },
  ): Promise<void> {
    const reqLogger = logger.withContext(
      `${context.routeType}:${context.routePath}`,
    )

    reqLogger.addBreadcrumb({
      type: "http",
      message: `${request.method} ${request.path}`,
    })

    reqLogger.captureError(err, {
      severity: "high",
      context: {
        source: "nextjs-onRequestError",
        method: request.method,
        path: request.path,
        routerKind: context.routerKind,
        routePath: context.routePath,
        routeType: context.routeType,
      },
    })
  }

  return { register, onRequestError, logger }
}
