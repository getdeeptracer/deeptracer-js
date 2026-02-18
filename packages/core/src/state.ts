import type { User, Breadcrumb } from "./types"

/**
 * Shared mutable state across a Logger and all its child loggers.
 * The root Logger creates this; `withContext()` and `forRequest()` pass
 * the same reference so mutations (setUser, addBreadcrumb, etc.) are
 * visible everywhere.
 */
export interface LoggerState {
  /** Current user context, set via setUser() */
  user: User | null
  /** Global tags (flat string key-values), merged as metadata._tags */
  tags: Record<string, string>
  /** Named context blocks, merged as metadata._contexts.{name} */
  contexts: Record<string, Record<string, unknown>>
  /** Ring buffer of breadcrumbs for error reports */
  breadcrumbs: Breadcrumb[]
  /** Max breadcrumbs to retain */
  maxBreadcrumbs: number
}

/** Create a fresh LoggerState. */
export function createLoggerState(maxBreadcrumbs: number): LoggerState {
  return {
    user: null,
    tags: {},
    contexts: {},
    breadcrumbs: [],
    maxBreadcrumbs,
  }
}

/** Add a breadcrumb to the ring buffer, evicting oldest if at capacity. */
export function addBreadcrumb(state: LoggerState, breadcrumb: Breadcrumb): void {
  state.breadcrumbs.push(breadcrumb)
  if (state.breadcrumbs.length > state.maxBreadcrumbs) {
    state.breadcrumbs.shift()
  }
}
