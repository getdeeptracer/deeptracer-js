import type { User, Breadcrumb } from "./types"

/**
 * Mutable state for a Logger instance.
 * The root Logger creates this; `withContext()` and `forRequest()` clone it
 * so each child logger gets an independent snapshot. Mutations on a child
 * (setUser, setTags, addBreadcrumb, etc.) do not affect the parent or siblings.
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

/**
 * Create an independent shallow clone of a LoggerState.
 * Used by `withContext()` and `forRequest()` so child loggers
 * don't share mutable state with the parent.
 */
export function cloneState(state: LoggerState): LoggerState {
  return {
    user: state.user ? { ...state.user } : null,
    tags: { ...state.tags },
    contexts: Object.fromEntries(
      Object.entries(state.contexts).map(([k, v]) => [k, { ...v }]),
    ),
    breadcrumbs: [...state.breadcrumbs],
    maxBreadcrumbs: state.maxBreadcrumbs,
  }
}

/** Add a breadcrumb to the ring buffer, evicting oldest if at capacity. */
export function addBreadcrumb(state: LoggerState, breadcrumb: Breadcrumb): void {
  state.breadcrumbs.push(breadcrumb)
  if (state.breadcrumbs.length > state.maxBreadcrumbs) {
    state.breadcrumbs.shift()
  }
}
