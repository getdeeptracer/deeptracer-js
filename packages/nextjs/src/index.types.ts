// Unified type declarations — TypeScript resolves this in all environments.
// At runtime, the bundler picks index.server.js or index.client.js
// based on the "browser" / "node" export condition.

// Server APIs (includes all core exports via @deeptracer/node)
export * from "@deeptracer/node"
export { init, type NextjsConfig, type InitResult } from "./init"
export { withServerAction } from "./server-action"
export { withRouteHandler } from "./route-handler"

// Client APIs (React components + hooks — no overlap with node exports above)
export {
  DeepTracerProvider,
  DeepTracerErrorPage,
  DeepTracerErrorBoundary,
  useDeepTracerErrorReporter,
  useLogger,
  type DeepTracerProviderProps,
} from "@deeptracer/react"
