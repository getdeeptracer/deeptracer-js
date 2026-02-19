# DeepTracer Next.js Package — Improvement Report

## Goal
Make `@deeptracer/nextjs` the most agentic-coding-friendly and vibe-coder-friendly observability SDK for Next.js, beating Sentry on every DX metric that matters for AI-assisted development.

---

## How Sentry Auto-Instruments Next.js (and why it's not agentic-friendly)

Sentry achieves auto-instrumentation through **build-time webpack code injection**:

```typescript
// next.config.ts — REQUIRED modification
import { withSentryConfig } from "@sentry/nextjs"
export default withSentryConfig(nextConfig, {
  webpack: {
    autoInstrumentServerFunctions: true,   // wraps API routes at build time
    autoInstrumentMiddleware: true,         // wraps middleware at build time
    autoInstrumentAppDirectory: true,       // wraps App Router components at build time
  },
})
```

This gives Sentry auto-tracing of route handlers, server components, and middleware **without per-route wrapping**. But the cost is enormous complexity:

### Sentry's Required Files (6 total)
1. `instrumentation.ts` — register + onRequestError
2. `instrumentation-client.ts` — client SDK init
3. `sentry.server.config.ts` — server SDK init (separate from instrumentation!)
4. `sentry.edge.config.ts` — edge SDK init
5. `app/global-error.tsx` — React error boundary
6. `next.config.ts` — must wrap with `withSentryConfig()`

### Why This Fails for AI Agents
- **6 files to coordinate** — AI agents frequently put config in the wrong file
- **`next.config.ts` modification** — most dangerous file to touch; merge conflicts, breaks builds
- **Webpack plugin is fragile** — breaks between Next.js versions, documented issues on GitHub
- **Server Actions STILL need manual wrapping** — even with all the webpack magic, `withServerActionInstrumentation()` is manual per action
- **Three separate config files** for server/edge/client — an AI agent has to understand Next.js runtimes to know which file gets what config

### DeepTracer's Current Advantage
1 file (`instrumentation.ts`), 5 lines. Zero ambiguity. But we lose auto-tracing of route handlers.

---

## Proposed Improvements

### 1. Zero-Config Init (Auto-Detect Env Vars)

**Current:**
```typescript
// instrumentation.ts
import { init } from "@deeptracer/nextjs"

export const { register, onRequestError } = init({
  product: "my-app",
  service: "web",
  environment: "production",
  endpoint: "https://your-deeptracer.com",
  apiKey: process.env.DEEPTRACER_API_KEY!,
})
```

**Proposed — zero-arg init:**
```typescript
// instrumentation.ts
import { init } from "@deeptracer/nextjs"
export const { register, onRequestError, logger } = init()
```

How it works:
- Reads `DEEPTRACER_API_KEY` from env (required, throws clear error if missing)
- Reads `DEEPTRACER_ENDPOINT` from env (required)
- Reads `DEEPTRACER_PRODUCT` from env, falls back to `package.json` name
- Reads `DEEPTRACER_SERVICE` from env, defaults to `"web"`
- Reads `DEEPTRACER_ENVIRONMENT` from env, defaults to `NODE_ENV === "production" ? "production" : "staging"`
- Reads `DEEPTRACER_DEBUG` from env for local dev console output

Explicit config still works as override. This makes the **entire instrumentation.ts a 2-line file**.

**Why this beats Sentry:** Sentry requires DSN in config files. DeepTracer reads everything from env vars — the AI agent only needs to add env vars to `.env.local`, which is the most natural thing for any AI agent to do.

### 2. Auto-Tracing Middleware Export

**Problem:** Route handler tracing currently requires manually wrapping every route with `withRouteHandler()`.

**Proposed — one-line middleware.ts:**
```typescript
// middleware.ts
export { middleware, config } from "@deeptracer/nextjs/middleware"
```

Or if the user already has middleware:
```typescript
// middleware.ts
import { withDeepTracer } from "@deeptracer/nextjs/middleware"
import { NextResponse } from "next/server"

function myMiddleware(request) {
  // existing logic
  return NextResponse.next()
}

export const middleware = withDeepTracer(myMiddleware)
```

What the middleware does:
- Generates a `trace_id` (or reads from incoming `x-trace-id` header)
- Generates a `span_id` for this request
- Injects `x-trace-id` and `x-span-id` into request headers (so route handlers and server components can read them via `logger.forRequest(request)`)
- Records request start time
- On response, calculates duration and sends a span to DeepTracer
- Adds `x-trace-id` to response headers (for debugging and cross-service propagation)

This gives **auto-tracing of every request** without touching any route handler files. Next.js middleware runs before every matched route — same coverage as Sentry's webpack injection, but with zero build-time magic.

**The middleware export also includes a default `config`:**
```typescript
export const config = {
  matcher: [
    // Match all routes except static files and _next internals
    "/((?!_next/static|_next/image|favicon.ico).*)",
  ],
}
```

**Why this beats Sentry:**
- Sentry's auto-instrumentation = webpack build-time code injection (fragile, breaks between Next.js versions)
- DeepTracer's auto-instrumentation = standard Next.js middleware (stable API, supported by Vercel, zero build config)
- If user already has middleware, `withDeepTracer()` is a clean wrapper — no fighting over `next.config.ts`

### 3. Auto-Detecting Client Provider

**Current:**
```tsx
// app/layout.tsx
import { DeepTracerProvider } from "@deeptracer/nextjs/client"

<DeepTracerProvider config={{
  product: "my-app",
  service: "web",
  environment: "production",
  endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT!,
  apiKey: process.env.NEXT_PUBLIC_DEEPTRACER_API_KEY!,
}}>
```

**Proposed — zero-config provider:**
```tsx
// app/layout.tsx
import { DeepTracerProvider } from "@deeptracer/nextjs/client"

<DeepTracerProvider>
  {children}
</DeepTracerProvider>
```

How it works:
- Reads `NEXT_PUBLIC_DEEPTRACER_API_KEY` from env
- Reads `NEXT_PUBLIC_DEEPTRACER_ENDPOINT` from env
- Reads `NEXT_PUBLIC_DEEPTRACER_PRODUCT` from env
- If any are missing, renders children without provider (no crash, just a console.warn in dev)

**Why this beats Sentry:** Sentry needs `instrumentation-client.ts` as a separate file for client init. DeepTracer's provider IS the client init — one component, zero config props.

### 4. One-Line Global Error Page (Already Exists — Promote It)

```tsx
// app/global-error.tsx
"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/nextjs/client"
```

DeepTracer already has this. Sentry requires you to manually write a `useEffect` + `captureException` in `global-error.tsx` — 15 lines vs 2 lines.

### 5. `minLevel` Filtering

**Problem:** Currently every log (including debug) gets batched and shipped to the backend. In production this is noisy and expensive.

**Proposed:**
```typescript
export interface LoggerConfig {
  // ... existing
  /** Minimum log level to send to DeepTracer. Default: "info" in production, "debug" otherwise */
  minLevel?: LogLevel
}
```

In the `log()` method:
```typescript
private log(level, message, ...) {
  const minLevel = this.config.minLevel ??
    (this.config.environment === "production" ? "info" : "debug")
  if (LOG_LEVELS[level] < LOG_LEVELS[minLevel]) {
    // Still output to console if debug mode, but don't send to backend
    if (this.config.debug) { /* console output */ }
    return
  }
  // ... batch and send
}
```

With zero-config init, `minLevel` defaults intelligently — no decision needed from the vibe coder.

### 6. `tracedFetch()` for Cross-Service Trace Propagation

**Problem:** When service A calls service B, the developer must manually pass `span.getHeaders()` to propagate trace context. This is error-prone and agents forget it.

**Proposed — drop-in fetch replacement:**
```typescript
import { tracedFetch } from "@deeptracer/nextjs"

// Instead of:
const res = await fetch("http://localhost:3002/internal/api/contacts", {
  headers: { "x-internal-key": key, "x-account-id": accountId }
})

// Use:
const res = await tracedFetch(logger, "http://localhost:3002/internal/api/contacts", {
  headers: { "x-internal-key": key, "x-account-id": accountId }
})
```

`tracedFetch` automatically:
- Creates a child span (`http:GET http://localhost:3002/internal/api/contacts`)
- Injects `x-trace-id` and `x-span-id` headers
- Records response status and duration
- Captures errors

**Even better — a global fetch patch option:**
```typescript
// instrumentation.ts
export const { register, onRequestError, logger } = init({
  patchFetch: true,  // monkey-patch global fetch to auto-trace
})
```

This makes ALL outgoing fetch calls auto-traced. Zero code changes in 478 files.

**Why this beats Sentry:** Sentry does auto-instrument fetch on the client side, but server-side fetch tracing in Next.js requires their webpack plugin. DeepTracer's `patchFetch` works at runtime — no build tooling.

### 7. `withServerAction` Improvement — Auto-Name from Function

**Current:**
```typescript
export async function createUser(formData: FormData) {
  return withServerAction(logger, "createUser", async () => {
    // ...
  })
}
```

**Proposed — infer name from function:**
```typescript
export const createUser = serverAction(logger, async function createUser(formData: FormData) {
  // ...
})
```

Or even simpler with a decorator-style API:
```typescript
export const createUser = traced(logger, async (formData: FormData) => {
  // ...
})
// Auto-names the span from the variable name if possible
```

This is a minor ergonomic improvement, but for AI agents generating server actions, the less boilerplate the better.

---

## The Complete "AI Agent Setup" — Before vs After

### Before (Current DeepTracer)
AI agent needs to:
1. Create `instrumentation.ts` (5 lines with config)
2. Wrap every route handler with `withRouteHandler()` (N files)
3. Wrap every server action with `withServerAction()` (N files)
4. Add `DeepTracerProvider` to layout with config props
5. Create `global-error.tsx`
6. Add env vars

### After (Proposed DeepTracer)
AI agent needs to:
1. Create `instrumentation.ts` (2 lines, zero config)
2. Create `middleware.ts` (1 line export — auto-traces ALL routes)
3. Add `<DeepTracerProvider>` to layout (zero props)
4. Create `global-error.tsx` (2 lines, already exists)
5. Add env vars to `.env.local`

**Total: 4 files, ~7 lines of code, zero configuration decisions.** Route handlers and server components are auto-traced via middleware. Errors are auto-captured via `onRequestError`. Client errors are auto-captured via provider + global-error.

### Sentry Equivalent
1. Create `instrumentation.ts`
2. Create `instrumentation-client.ts`
3. Create `sentry.server.config.ts`
4. Create `sentry.edge.config.ts`
5. Modify `next.config.ts` with `withSentryConfig()`
6. Create `app/global-error.tsx` (15 lines with useEffect + captureException)
7. Still manually wrap every server action with `withServerActionInstrumentation()`
8. Add env vars

**Total: 6 files, 50+ lines of code, must understand Next.js runtimes to know which config goes where.**

---

## Comparison Matrix: Proposed DeepTracer vs Sentry

| Metric | DeepTracer (Proposed) | Sentry | Winner |
|--------|----------------------|--------|--------|
| Files to create | 4 | 6 | DeepTracer |
| Lines of setup code | ~7 | ~50+ | DeepTracer |
| Config decisions required | 0 (env vars only) | 5+ (DSN, org, project, auth token, tunnel) | DeepTracer |
| Auto route handler tracing | Yes (middleware) | Yes (webpack injection) | Tie |
| Auto server action tracing | No (manual wrap) | No (manual wrap) | Tie |
| Auto error capture | Yes (onRequestError) | Yes (onRequestError) | Tie |
| Auto client errors | Yes (provider + global-error) | Yes (global-error + client file) | DeepTracer |
| Build config modification | None | Required (next.config.ts) | DeepTracer |
| Breaks between Next.js versions | No (uses stable APIs only) | Yes (webpack plugin is fragile) | DeepTracer |
| LLM/AI tracking | Native (wrapVercelAI, wrapOpenAI) | Added later, Python-first | DeepTracer |
| Cross-service trace propagation | `tracedFetch` / `patchFetch` | Auto on client, manual on server | DeepTracer |
| AI agent can set up correctly | ~100% (zero ambiguity) | ~60% (6 files, runtime confusion) | DeepTracer |
| Source maps | Not yet | Auto-upload via webpack | Sentry |
| Error grouping/dedup | Backend feature (TBD) | Mature | Sentry |
| Session replay | No | Yes | Sentry |
| Alerting integrations | Backend feature (TBD) | Mature (Slack, PagerDuty) | Sentry |

---

## Implementation Priority

| Priority | Improvement | Effort | Impact |
|----------|-----------|--------|--------|
| P0 | Zero-config `init()` (env var auto-detect) | Small | Huge — eliminates all config decisions |
| P0 | `minLevel` filtering | Small | Required — don't ship debug logs in prod |
| P1 | Middleware export for auto-tracing | Medium | Huge — eliminates per-route wrapping |
| P1 | Zero-config `DeepTracerProvider` | Small | Good — one less thing to configure |
| P2 | `tracedFetch` / `patchFetch` | Medium | Great for multi-service architectures |
| P2 | Fix `environment` type (allow "development") | Tiny | Quality of life |
| P3 | Improved `withServerAction` ergonomics | Small | Minor DX improvement |

---

## Summary

DeepTracer's core architecture is already better than Sentry's for agentic coding. The improvements above close the remaining gaps:

1. **Zero-config init** eliminates all configuration decisions — env vars only
2. **Middleware-based auto-tracing** gives Sentry-level auto-instrumentation without webpack injection
3. **Zero-config provider** makes client-side setup a single component with no props
4. **`tracedFetch`/`patchFetch`** solves cross-service tracing without manual header passing
5. **`minLevel`** prevents debug log flooding in production

The result: **4 files, 7 lines, zero decisions, full observability.** No other SDK achieves this for Next.js.
