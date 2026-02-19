// Client-side entry — resolved by bundler when "browser" condition matches
// "use client" banner added by tsup

// Browser-safe Logger API (all core exports via browser — no Node.js APIs)
export * from "@deeptracer/browser"

// React components and hooks
export {
  DeepTracerProvider,
  DeepTracerErrorPage,
  DeepTracerErrorBoundary,
  useDeepTracerErrorReporter,
  useLogger,
  type DeepTracerProviderProps,
} from "@deeptracer/react"
