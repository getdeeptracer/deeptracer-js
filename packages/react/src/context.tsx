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
   *   publicKey: process.env.NEXT_PUBLIC_DEEPTRACER_KEY!,
   *   endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT!,
   *   product: "my-app",
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
 *       publicKey: process.env.NEXT_PUBLIC_DEEPTRACER_KEY!,
 *       endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT!,
 *       product: "my-app",
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
  }, [])

  return <DeepTracerContext.Provider value={logger}>{children}</DeepTracerContext.Provider>
}

/**
 * Read LoggerConfig from NEXT_PUBLIC_DEEPTRACER_* env vars.
 * Returns null if required vars (key + endpoint) are missing.
 *
 * @internal Exported for use by error-boundary.tsx fallback.
 */
export function readConfigFromEnv(): LoggerConfig | null {
  const safeEnv = (name: string): string | undefined =>
    typeof process !== "undefined" ? process.env?.[name] : undefined

  const publicKey = safeEnv("NEXT_PUBLIC_DEEPTRACER_KEY")
  const endpoint = safeEnv("NEXT_PUBLIC_DEEPTRACER_ENDPOINT")

  if (!publicKey || !endpoint) return null

  const level = safeEnv("NEXT_PUBLIC_DEEPTRACER_LOG_LEVEL") as
    | "debug" | "info" | "warn" | "error"
    | undefined

  return {
    publicKey,
    endpoint,
    product: safeEnv("NEXT_PUBLIC_DEEPTRACER_PRODUCT") ?? "unknown",
    service: safeEnv("NEXT_PUBLIC_DEEPTRACER_SERVICE") ?? "web",
    environment: safeEnv("NEXT_PUBLIC_DEEPTRACER_ENVIRONMENT") ?? "production",
    level,
  }
}
