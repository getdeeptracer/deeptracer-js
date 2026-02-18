// Re-export everything from core so users only need @deeptracer/browser
export * from "@deeptracer/core"

// Browser-specific features
export { captureGlobalErrors } from "./global-errors"
export { captureConsole } from "./console"
