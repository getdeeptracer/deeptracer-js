// Internal exports for sibling packages (@deeptracer/node, @deeptracer/browser)
// NOT part of the public API — may change without notice
export { _originalConsole, Logger } from "./logger"
export type { LoggerConfig, MiddlewareOptions } from "./types"
export type { LoggerState } from "./state"

// ---------------------------------------------------------------------------
// Console argument parser — shared by node, browser, and nextjs packages
// ---------------------------------------------------------------------------

/** Circular-safe JSON.stringify with special handling for Error, BigInt, Symbol, functions. */
function safeStringify(value: unknown): string {
  const seen = new WeakSet()
  return JSON.stringify(value, (_key, val) => {
    if (val instanceof Error) {
      return { name: val.name, message: val.message, stack: val.stack }
    }
    if (typeof val === "bigint") return val.toString()
    if (typeof val === "symbol") return val.toString()
    if (typeof val === "function") return `[Function: ${val.name || "anonymous"}]`
    if (val !== null && typeof val === "object") {
      if (seen.has(val)) return "[Circular]"
      seen.add(val)
    }
    return val
  })
}

/**
 * Parse console.log/info/warn/error arguments into a structured `{ message, metadata }` pair.
 *
 * - First string arg → message; remaining objects → merged into metadata
 * - If first string has printf patterns (`%s`, `%d`, `%o`, etc.) → join all as string, no metadata
 * - First non-string arg → `safeStringify` it for message
 * - Error objects → serialize `{ name, message, stack }` into metadata
 * - Remaining primitives → append to message string
 */
export function parseConsoleArgs(args: unknown[]): {
  message: string
  metadata?: Record<string, unknown>
} {
  if (args.length === 0) return { message: "" }

  const first = args[0]

  // Printf-style format string — join everything as a single string
  if (typeof first === "string" && /%[sdifoc%]/.test(first)) {
    return { message: args.map(String).join(" ") }
  }

  // First arg is a string — use as message, process the rest
  if (typeof first === "string") {
    const messageParts: string[] = [first]
    const metadata: Record<string, unknown> = {}
    let metadataCount = 0

    for (let i = 1; i < args.length; i++) {
      const arg = args[i]

      if (arg instanceof Error) {
        metadata[`error${metadataCount > 0 ? `_${metadataCount}` : ""}`] = {
          name: arg.name,
          message: arg.message,
          stack: arg.stack,
        }
        metadataCount++
      } else if (arg !== null && typeof arg === "object") {
        Object.assign(metadata, arg)
        metadataCount++
      } else if (arg !== undefined) {
        messageParts.push(String(arg))
      }
    }

    return {
      message: messageParts.join(" "),
      metadata: metadataCount > 0 ? metadata : undefined,
    }
  }

  // First arg is not a string
  if (first instanceof Error) {
    return {
      message: first.message,
      metadata: { error: { name: first.name, message: first.message, stack: first.stack } },
    }
  }

  if (first !== null && typeof first === "object") {
    return { message: safeStringify(first) }
  }

  return { message: String(first) }
}
