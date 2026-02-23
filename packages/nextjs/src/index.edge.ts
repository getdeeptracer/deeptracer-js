// Edge-safe entry — resolved by bundler when "edge-light" or "worker" condition matches.
// No OpenTelemetry, no Node.js built-ins (diagnostics_channel, process.on).
// Re-exports from @deeptracer/core (not @deeptracer/node which has Node.js-specific features).

export * from "@deeptracer/core"

export { init, type NextjsConfig, type InitResult } from "./init-edge"
export { withServerAction } from "./server-action"
export { withRouteHandler } from "./route-handler"
