"use client"

import { createContext, useEffect, useRef, useState, type ReactNode } from "react"
import { createLogger, type Logger, type LoggerConfig } from "@deeptracer/browser"
import { captureGlobalErrors } from "@deeptracer/browser"

/**
 * React context holding the DeepTracer Logger instance.
 * Access it with the `useLogger()` hook.
 * @internal
 */
export const DeepTracerContext = createContext<Logger | null>(null)

/**
 * Props for the DeepTracerProvider component.
 *
 * Pass either a `config` object to create a new Logger, or an existing
 * `logger` instance. If neither is given, reads from `NEXT_PUBLIC_DEEPTRACER_*`
 * environment variables automatically (zero-config for Next.js).
 */
export interface DeepTracerProviderProps {
  /**
   * Logger configuration. A new Logger is created internally.
   * Mutually exclusive with `logger`.
   *
   * @example
   * ```tsx
   * <DeepTracerProvider config={{
   *   product: "my-app",
   *   service: "web",
   *   environment: "production",
   *   endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT!,
   *   apiKey: process.env.NEXT_PUBLIC_DEEPTRACER_API_KEY!,
   * }}>
   * ```
   */
  config?: LoggerConfig
  /**
   * An existing Logger instance to share with child components.
   * Mutually exclusive with `config`.
   */
  logger?: Logger
  /**
   * Automatically capture unhandled window errors and promise rejections.
   * Default: true
   */
  captureErrors?: boolean
  /** Child components that will have access to the logger via useLogger(). */
  children: ReactNode
}

/**
 * Provides a DeepTracer Logger to all child components via React context.
 *
 * Automatically captures browser global errors (window.onerror and
 * unhandledrejection) unless `captureErrors={false}`.
 *
 * The Logger is created once on mount and destroyed on unmount.
 *
 * @example
 * With explicit config:
 * ```tsx
 * import { DeepTracerProvider } from "@deeptracer/react"
 *
 * export default function App({ children }) {
 *   return (
 *     <DeepTracerProvider config={{
 *       product: "my-app",
 *       service: "web",
 *       environment: "production",
 *       endpoint: "https://deeptracer.example.com",
 *       apiKey: process.env.NEXT_PUBLIC_DEEPTRACER_API_KEY!,
 *     }}>
 *       {children}
 *     </DeepTracerProvider>
 *   )
 * }
 * ```
 *
 * @example
 * Zero-config (reads NEXT_PUBLIC_DEEPTRACER_* env vars):
 * ```tsx
 * <DeepTracerProvider>{children}</DeepTracerProvider>
 * ```
 */
export function DeepTracerProvider({
  config,
  logger: externalLogger,
  captureErrors = true,
  children,
}: DeepTracerProviderProps) {
  const [logger, setLogger] = useState<Logger | null>(externalLogger ?? null)
  const ownsLogger = useRef(false)

  useEffect(() => {
    if (externalLogger) {
      setLogger(externalLogger)
      ownsLogger.current = false
      return
    }

    const resolvedConfig = config ?? readConfigFromEnv()
    if (!resolvedConfig) {
      console.warn(
        "[@deeptracer/react] DeepTracerProvider: No config, logger, or NEXT_PUBLIC_DEEPTRACER_* env vars found. " +
          "Logger is disabled. Pass a config prop or set environment variables.",
      )
      return
    }

    const newLogger = createLogger(resolvedConfig)
    setLogger(newLogger)
    ownsLogger.current = true

    if (captureErrors) {
      captureGlobalErrors(newLogger)
    }

    return () => {
      newLogger.destroy().catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <DeepTracerContext.Provider value={logger}>
      {children}
    </DeepTracerContext.Provider>
  )
}

/** Read LoggerConfig from NEXT_PUBLIC_DEEPTRACER_* env vars. Returns null if required vars missing. */
function readConfigFromEnv(): LoggerConfig | null {
  const endpoint =
    typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_DEEPTRACER_ENDPOINT : undefined
  const apiKey =
    typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_DEEPTRACER_API_KEY : undefined
  const product =
    typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_DEEPTRACER_PRODUCT : undefined

  if (!endpoint || !apiKey || !product) return null

  const service =
    (typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_DEEPTRACER_SERVICE : undefined) ?? "web"
  const environment =
    ((typeof process !== "undefined" ? process.env?.NEXT_PUBLIC_DEEPTRACER_ENVIRONMENT : undefined) as
      | "production"
      | "staging"
      | undefined) ?? "production"

  return { product, service, environment, endpoint, apiKey }
}
