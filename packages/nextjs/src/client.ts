/**
 * Client-side DeepTracer components for Next.js.
 *
 * Import from `@deeptracer/nextjs/client` in client components.
 *
 * @example
 * ```tsx
 * // app/layout.tsx — zero-config provider (reads NEXT_PUBLIC_DEEPTRACER_* env vars)
 * import { DeepTracerProvider } from "@deeptracer/nextjs/client"
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <html><body>
 *       <DeepTracerProvider>
 *         {children}
 *       </DeepTracerProvider>
 *     </body></html>
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // app/layout.tsx — explicit config
 * import { DeepTracerProvider } from "@deeptracer/nextjs/client"
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <html><body>
 *       <DeepTracerProvider config={{
 *         publicKey: process.env.NEXT_PUBLIC_DEEPTRACER_KEY!,
 *         endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT!,
 *         product: "my-app",
 *       }}>
 *         {children}
 *       </DeepTracerProvider>
 *     </body></html>
 *   )
 * }
 * ```
 *
 * @example
 * ```tsx
 * // app/global-error.tsx — one-line error boundary
 * "use client"
 * export { DeepTracerErrorPage as default } from "@deeptracer/nextjs/client"
 * ```
 */
export {
  DeepTracerProvider,
  DeepTracerErrorPage,
  DeepTracerErrorBoundary,
  useDeepTracerErrorReporter,
  useLogger,
  type DeepTracerProviderProps,
} from "@deeptracer/react"
