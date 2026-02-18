// Re-export everything from core so users only need @deeptracer/node
export * from "@deeptracer/core"

// Node.js specific features
export { captureGlobalErrors } from "./global-errors"
export { captureConsole } from "./console"
export { honoMiddleware, expressMiddleware } from "./middleware"
export { init } from "./init"
