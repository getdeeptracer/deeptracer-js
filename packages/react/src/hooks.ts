"use client"

import { useContext } from "react"
import type { Logger } from "@deeptracer/browser"
import { DeepTracerContext } from "./context"

/**
 * Access the DeepTracer Logger instance from React context.
 *
 * Must be used inside a `<DeepTracerProvider>`. Throws with a clear
 * error message if no provider is found.
 *
 * @returns The Logger instance from the nearest DeepTracerProvider
 * @throws Error if called outside a DeepTracerProvider
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
  if (!logger) {
    throw new Error(
      "[@deeptracer/react] useLogger() must be used inside a <DeepTracerProvider>. " +
        "Wrap your app with <DeepTracerProvider config={{...}}>.",
    )
  }
  return logger
}
