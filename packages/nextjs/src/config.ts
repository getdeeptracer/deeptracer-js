import type { NextConfig } from "next"

/**
 * OpenTelemetry packages used by DeepTracer's auto-tracing feature.
 * These must be excluded from Next.js bundling because they use Node.js
 * built-in modules (like `diagnostics_channel`) that don't exist in
 * browser or edge environments.
 */
const EXTERNAL_PACKAGES = [
  "@opentelemetry/api",
  "@opentelemetry/core",
  "@opentelemetry/sdk-trace-base",
  "@opentelemetry/sdk-trace-node",
  "@opentelemetry/instrumentation-undici",
]

/**
 * Wraps your Next.js config to prevent OpenTelemetry packages from being
 * bundled into client-side or edge chunks. Without this, Next.js's bundler
 * (Webpack or Turbopack) may try to resolve Node.js-only modules like
 * `diagnostics_channel` and fail.
 *
 * @param config - Your existing Next.js config (default: `{}`)
 * @returns The same config with DeepTracer's required `serverExternalPackages` merged in
 *
 * @example
 * ```ts
 * // next.config.ts
 * import { withDeepTracer } from "@deeptracer/nextjs/config"
 *
 * export default withDeepTracer({
 *   // your existing Next.js config
 * })
 * ```
 *
 * @example
 * Composing with other wrappers:
 * ```ts
 * import { withDeepTracer } from "@deeptracer/nextjs/config"
 * import { withSentryConfig } from "@sentry/nextjs"
 *
 * export default withDeepTracer(withSentryConfig({ reactStrictMode: true }))
 * ```
 */
export function withDeepTracer(config: NextConfig = {}): NextConfig {
  const existing = config.serverExternalPackages ?? []
  return {
    ...config,
    serverExternalPackages: [
      ...existing,
      ...EXTERNAL_PACKAGES.filter((p) => !existing.includes(p)),
    ],
  }
}
