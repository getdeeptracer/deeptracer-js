/**
 * Client-side DeepTracer components for Next.js.
 *
 * Import from `@deeptracer/nextjs/client` in client components.
 *
 * @example
 * ```tsx
 * // app/layout.tsx — add provider for client-side error capture
 * import { DeepTracerProvider } from "@deeptracer/nextjs/client"
 *
 * export default function RootLayout({ children }: { children: React.ReactNode }) {
 *   return (
 *     <html><body>
 *       <DeepTracerProvider config={{
 *         product: "my-app",
 *         service: "web",
 *         environment: "production",
 *         endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT!,
 *         apiKey: process.env.NEXT_PUBLIC_DEEPTRACER_API_KEY!,
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
