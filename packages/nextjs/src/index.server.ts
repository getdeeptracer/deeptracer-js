// Server-side entry — resolved by bundler when "node" condition matches
// Re-export everything from node SDK (Next.js server runs on Node.js)
export * from "@deeptracer/node"

// Next.js specific features
export { init, type NextjsConfig, type InitResult } from "./init"
export { withServerAction } from "./server-action"
export { withRouteHandler } from "./route-handler"
