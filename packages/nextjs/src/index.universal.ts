// Boundary-neutral entry — no "use client", no "server-only".
// Safe to import from server code, client code, and shared modules.
//
// Use this for code that's imported by BOTH server and client:
//   import { createLogger } from "@deeptracer/nextjs/universal"
//
// For server-only code (instrumentation.ts, API routes): import from "@deeptracer/nextjs"
// For client-only code ("use client" components):        import from "@deeptracer/nextjs/client"

export { createLogger, Logger, type LoggerConfig, type LogLevel } from "@deeptracer/core"
export type {
  LogEntry,
  ErrorReport,
  LLMUsageReport,
  SpanData,
  Span,
  InactiveSpan,
  User,
  Breadcrumb,
  BeforeSendEvent,
} from "@deeptracer/core"
