"use client"

import { Component, useContext, useEffect, type ReactNode, type ErrorInfo } from "react"
import { createLogger, type Logger } from "@deeptracer/browser"
import { DeepTracerContext, readConfigFromEnv } from "./context"

/**
 * Create a standalone logger from env vars, report the error, then clean up.
 * Used as a fallback when no DeepTracerProvider is in the tree (e.g., global-error.tsx).
 */
function reportWithFallbackLogger(
  error: Error,
  severity: "low" | "medium" | "high" | "critical",
  source: string,
  extraContext?: Record<string, unknown>,
): void {
  const config = readConfigFromEnv()
  if (!config) {
    console.error(
      `[@deeptracer/react] ${source}: No DeepTracerProvider and no NEXT_PUBLIC_DEEPTRACER_* env vars found. ` +
        "Error not reported to DeepTracer.",
    )
    return
  }

  const logger = createLogger(config)
  logger.captureError(error, {
    severity,
    context: { source, ...extraContext },
  })
  logger.flush()
  logger.destroy().catch(() => {})
}

// ─── Next.js error.tsx compatible component ─────────────────────────────────

/**
 * Drop-in error page component for Next.js `error.tsx` or `global-error.tsx`.
 *
 * Automatically reports the error to DeepTracer when a `<DeepTracerProvider>`
 * is present in the component tree. If no provider is found (common in
 * `global-error.tsx` which replaces the entire document), creates a standalone
 * logger from `NEXT_PUBLIC_DEEPTRACER_*` env vars to ensure errors are still reported.
 *
 * @example
 * One-line setup for `app/global-error.tsx`:
 * ```tsx
 * "use client"
 * export { DeepTracerErrorPage as default } from "@deeptracer/react"
 * ```
 *
 * @example
 * One-line setup for `app/error.tsx`:
 * ```tsx
 * "use client"
 * export { DeepTracerErrorPage as default } from "@deeptracer/react"
 * ```
 */
export function DeepTracerErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const logger = useContext(DeepTracerContext)

  useEffect(() => {
    if (logger) {
      logger.captureError(error, {
        severity: "high",
        context: {
          source: "react-error-page",
          digest: error.digest,
        },
      })
    } else {
      reportWithFallbackLogger(error, "high", "react-error-page", {
        digest: error.digest,
      })
    }
  }, [error, logger])

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h2 style={{ marginBottom: "1rem" }}>Something went wrong</h2>
      <p style={{ color: "#666", marginBottom: "1.5rem" }}>
        {error.message || "An unexpected error occurred."}
      </p>
      <button
        onClick={reset}
        style={{
          padding: "0.5rem 1rem",
          borderRadius: "0.375rem",
          border: "1px solid #ccc",
          background: "#fff",
          cursor: "pointer",
          fontSize: "0.875rem",
        }}
      >
        Try again
      </button>
    </div>
  )
}

// ─── Hook for custom error pages ────────────────────────────────────────────

/**
 * Hook that reports an error to DeepTracer. Use in custom `error.tsx` pages
 * when you want your own UI but still want automatic error reporting.
 *
 * Falls back to a standalone logger from env vars if no provider is found.
 *
 * @param error - The error to report
 * @param severity - Error severity (default: "high")
 *
 * @example
 * ```tsx
 * // app/error.tsx
 * "use client"
 * import { useDeepTracerErrorReporter } from "@deeptracer/react"
 *
 * export default function ErrorPage({ error, reset }) {
 *   useDeepTracerErrorReporter(error)
 *   return <div>Custom error UI <button onClick={reset}>Retry</button></div>
 * }
 * ```
 */
export function useDeepTracerErrorReporter(
  error: Error,
  severity: "low" | "medium" | "high" | "critical" = "high",
) {
  const logger = useContext(DeepTracerContext)

  useEffect(() => {
    if (logger) {
      logger.captureError(error, {
        severity,
        context: { source: "react-error-page" },
      })
    } else {
      reportWithFallbackLogger(error, severity, "react-error-page")
    }
  }, [error, logger, severity])
}

// ─── Class-based error boundary for wrapping component trees ────────────────

/**
 * Props for the DeepTracerErrorBoundary component.
 */
interface ErrorBoundaryProps {
  /** Content to render when an error occurs. Static ReactNode or render function. */
  fallback?: ReactNode | ((props: { error: Error; resetErrorBoundary: () => void }) => ReactNode)
  /** Child components to protect with the error boundary. */
  children: ReactNode
  /** Called when an error is caught, after reporting to DeepTracer. */
  onError?: (error: Error, errorInfo: ErrorInfo) => void
}

interface ErrorBoundaryState {
  hasError: boolean
  error: Error | null
}

/**
 * Error boundary component that catches React rendering errors in child
 * components and automatically reports them to DeepTracer.
 *
 * Falls back to a standalone logger from env vars if no provider is found.
 *
 * For Next.js `error.tsx` / `global-error.tsx`, use `DeepTracerErrorPage` instead.
 * This component is for wrapping arbitrary React trees.
 *
 * @example
 * ```tsx
 * import { DeepTracerErrorBoundary } from "@deeptracer/react"
 *
 * function App() {
 *   return (
 *     <DeepTracerErrorBoundary fallback={<div>Something went wrong</div>}>
 *       <MyComponent />
 *     </DeepTracerErrorBoundary>
 *   )
 * }
 * ```
 *
 * @example
 * With render function fallback:
 * ```tsx
 * <DeepTracerErrorBoundary
 *   fallback={({ error, resetErrorBoundary }) => (
 *     <div>
 *       <p>Error: {error.message}</p>
 *       <button onClick={resetErrorBoundary}>Retry</button>
 *     </div>
 *   )}
 * >
 *   <MyComponent />
 * </DeepTracerErrorBoundary>
 * ```
 */
export class DeepTracerErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  static contextType = DeepTracerContext
  declare context: Logger | null

  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    const logger = this.context
    if (logger) {
      logger.captureError(error, {
        severity: "high",
        context: {
          source: "react-error-boundary",
          componentStack: errorInfo.componentStack ?? undefined,
        },
      })
    } else {
      reportWithFallbackLogger(error, "high", "react-error-boundary", {
        componentStack: errorInfo.componentStack ?? undefined,
      })
    }
    this.props.onError?.(error, errorInfo)
  }

  resetErrorBoundary = () => {
    this.setState({ hasError: false, error: null })
  }

  render() {
    if (this.state.hasError && this.state.error) {
      const { fallback } = this.props
      if (typeof fallback === "function") {
        return (fallback as (props: { error: Error; resetErrorBoundary: () => void }) => ReactNode)(
          {
            error: this.state.error,
            resetErrorBoundary: this.resetErrorBoundary,
          },
        )
      }
      if (fallback) {
        return fallback
      }
      return (
        <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
          <h2 style={{ marginBottom: "1rem" }}>Something went wrong</h2>
          <p style={{ color: "#666", marginBottom: "1.5rem" }}>
            {this.state.error.message || "An unexpected error occurred."}
          </p>
          <button
            onClick={this.resetErrorBoundary}
            style={{
              padding: "0.5rem 1rem",
              borderRadius: "0.375rem",
              border: "1px solid #ccc",
              background: "#fff",
              cursor: "pointer",
              fontSize: "0.875rem",
            }}
          >
            Try again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
