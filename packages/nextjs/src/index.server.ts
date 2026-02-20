// Server-side entry — resolved by bundler when "node" condition matches.
// The "server-only" import ensures a clear build error if this entry is
// accidentally imported from a "use client" file (instead of @deeptracer/nextjs/client).
import "server-only"

// Re-export everything from node SDK (Next.js server runs on Node.js)
export * from "@deeptracer/node"

// Next.js specific features
export { init, type NextjsConfig, type InitResult } from "./init"
export { withServerAction } from "./server-action"
export { withRouteHandler } from "./route-handler"
