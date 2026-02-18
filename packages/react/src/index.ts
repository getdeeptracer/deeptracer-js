// Re-export everything from browser SDK so users only need @deeptracer/react
export * from "@deeptracer/browser"

// React-specific features
export { DeepTracerProvider, type DeepTracerProviderProps } from "./context"
export {
  DeepTracerErrorPage,
  DeepTracerErrorBoundary,
  useDeepTracerErrorReporter,
} from "./error-boundary"
export { useLogger } from "./hooks"
