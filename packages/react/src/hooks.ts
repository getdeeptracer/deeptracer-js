"use client"

import { useContext } from "react"
import type { Logger } from "@deeptracer/browser"
import { DeepTracerContext } from "./context"
import { noopLogger } from "./noop-logger"

/**
 * Access the DeepTracer Logger instance from React context.
 *
 * Returns a no-op logger (safe to call, does nothing) when:
 * - Called during SSR/SSG (provider hasn't initialized yet)
 * - No `<DeepTracerProvider>` is in the component tree
 *
 * After hydration, once the provider's `useEffect` creates the real
 * logger, React re-renders consumers and this hook returns the real instance.
 *
 * @returns The Logger from the nearest DeepTracerProvider, or a no-op fallback
 *
 * @example
 * ```tsx
 * import { useLogger } from "@deeptracer/react"
 *
 * function MyComponent() {
 *   const logger = useLogger()
 *
 *   function handleClick() {
 *     logger.info("Button clicked", { component: "MyComponent" })
 *   }
 *
 *   return <button onClick={handleClick}>Click me</button>
 * }
 * ```
 *
 * @example
 * Capture errors manually:
 * ```tsx
 * function SubmitForm() {
 *   const logger = useLogger()
 *
 *   async function handleSubmit() {
 *     try {
 *       await submitData()
 *     } catch (error) {
 *       logger.captureError(error, { severity: "high" })
 *     }
 *   }
 * }
 * ```
 */
export function useLogger(): Logger {
  const logger = useContext(DeepTracerContext)
  return logger ?? noopLogger
}
