// Client-side entry for "use client" files — import from "@deeptracer/nextjs/client".
// "use client" banner added by tsup.
//
// Available exports:
//   React:     DeepTracerProvider, useLogger, DeepTracerErrorPage, DeepTracerErrorBoundary, useDeepTracerErrorReporter
//   Standalone: createLogger (for "use client" files outside React)
//   Types:     LoggerConfig, Logger, User, Breadcrumb, Span, InactiveSpan, etc.
//
// NOTE: useLogger() is safe to call without a provider — returns a no-op logger during SSR/SSG.
// NOTE: For shared code (imported by both server and client), use @deeptracer/nextjs/universal instead.

// Browser-safe Logger API (all core exports via browser — no Node.js APIs)
export { createLogger } from "@deeptracer/browser"
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
