# @deeptracer/react

[![npm](https://img.shields.io/npm/v/@deeptracer/react?color=blue)](https://www.npmjs.com/package/@deeptracer/react)

DeepTracer React integration — provider, error boundary, and hooks for automatic error capture. Re-exports everything from `@deeptracer/browser`.

## Installation

```bash
npm install @deeptracer/react
```

**Peer dependencies:** `react >=18`, `react-dom >=18`

## Quick Start

```tsx
import { DeepTracerProvider, DeepTracerErrorBoundary, useLogger } from "@deeptracer/react"

function App() {
  return (
    <DeepTracerProvider config={{
      service: "web",
      environment: "production",
      endpoint: "https://deeptracer.example.com",
      publicKey: "dt_public_xxx",
    }}>
      <DeepTracerErrorBoundary fallback={<div>Something went wrong</div>}>
        <MyApp />
      </DeepTracerErrorBoundary>
    </DeepTracerProvider>
  )
}

function MyApp() {
  const logger = useLogger()

  function handleClick() {
    logger.info("Button clicked", { component: "MyApp" })
  }

  return <button onClick={handleClick}>Click me</button>
}
```

## API Reference

### `DeepTracerProvider`

React context provider that creates and manages a DeepTracer Logger instance. Automatically captures browser global errors (`window.onerror` and `unhandledrejection`).

**Props:**

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `config` | `LoggerConfig` | — | Logger configuration. Creates a new Logger internally. |
| `logger` | `Logger` | — | An existing Logger instance to share. Mutually exclusive with `config`. |
| `captureErrors` | `boolean` | `true` | Automatically capture unhandled window errors. |
| `children` | `ReactNode` | — | Child components with access to the logger via `useLogger()`. |

If neither `config` nor `logger` is provided, the provider reads from environment variables automatically:

| Environment Variable | Description |
|---------------------|-------------|
| `NEXT_PUBLIC_DEEPTRACER_ENDPOINT` | Ingestion endpoint URL (required) |
| `NEXT_PUBLIC_DEEPTRACER_KEY` | Public key (required) |
| `NEXT_PUBLIC_DEEPTRACER_SERVICE` | Service name (default: `"web"`) |
| `NEXT_PUBLIC_DEEPTRACER_ENVIRONMENT` | `"production"` or `"staging"` (default: `"production"`) |

```tsx
// Explicit config
<DeepTracerProvider config={{
  service: "web",
  environment: "production",
  endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT!,
  publicKey: process.env.NEXT_PUBLIC_DEEPTRACER_KEY!,
}}>
  {children}
</DeepTracerProvider>

// Zero-config (reads NEXT_PUBLIC_DEEPTRACER_* env vars)
<DeepTracerProvider>{children}</DeepTracerProvider>

// Existing logger instance
<DeepTracerProvider logger={myLogger}>{children}</DeepTracerProvider>
```

---

### `DeepTracerErrorPage`

Drop-in function component for Next.js `error.tsx` or `global-error.tsx`. Receives `{ error, reset }` from Next.js, calls `captureError()` in `useEffect`, and shows a default fallback UI with a "Try again" button.

**Works with or without a provider.** If a `<DeepTracerProvider>` is in the tree, uses that logger. If not (e.g., `global-error.tsx` which replaces the entire document), automatically creates a standalone logger from `NEXT_PUBLIC_DEEPTRACER_*` env vars, reports the error, and cleans up.

**One-line setup:**

```tsx
// app/global-error.tsx — works WITHOUT a provider
"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/react"
```

```tsx
// app/error.tsx — works WITH the provider from layout.tsx
"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/react"
```

---

### `useDeepTracerErrorReporter(error, severity?)`

Hook for custom error pages that still want automatic error reporting. Use when you want your own UI but still want DeepTracer to capture the error.

**Works with or without a provider.** Falls back to a standalone logger from `NEXT_PUBLIC_DEEPTRACER_*` env vars when no `<DeepTracerProvider>` is in the tree — safe for `global-error.tsx`.

**Parameters:**
- `error: Error` — the error to report
- `severity: "low" | "medium" | "high" | "critical"` — default: `"high"`

```tsx
// app/error.tsx — custom UI with automatic reporting
"use client"
import { useDeepTracerErrorReporter } from "@deeptracer/react"

export default function ErrorPage({ error, reset }: { error: Error; reset: () => void }) {
  useDeepTracerErrorReporter(error)
  return (
    <div>
      <h2>Oops! {error.message}</h2>
      <button onClick={reset}>Try again</button>
    </div>
  )
}
```

```tsx
// app/global-error.tsx — also works here (no provider needed)
"use client"
import { useDeepTracerErrorReporter } from "@deeptracer/react"

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useDeepTracerErrorReporter(error, "critical")
  return (
    <html><body>
      <h2>Something went wrong</h2>
      <button onClick={reset}>Try again</button>
    </body></html>
  )
}
```

---

### `DeepTracerErrorBoundary`

Class-based React error boundary that catches rendering errors in child components and reports them to DeepTracer. **Works with or without a provider** — falls back to a standalone logger from env vars.

**Props:**

| Prop | Type | Description |
|------|------|-------------|
| `fallback` | `ReactNode \| (({ error, resetErrorBoundary }) => ReactNode)` | Content to show on error. |
| `children` | `ReactNode` | Components to protect. |
| `onError` | `(error: Error, errorInfo: ErrorInfo) => void` | Called after the error is caught and reported. |

```tsx
import { DeepTracerErrorBoundary } from "@deeptracer/react"

// Static fallback
<DeepTracerErrorBoundary fallback={<div>Something went wrong</div>}>
  <MyComponent />
</DeepTracerErrorBoundary>

// Render function fallback
<DeepTracerErrorBoundary
  fallback={({ error, resetErrorBoundary }) => (
    <div>
      <p>Error: {error.message}</p>
      <button onClick={resetErrorBoundary}>Retry</button>
    </div>
  )}
>
  <MyComponent />
</DeepTracerErrorBoundary>
```

---

### `useLogger()`

Hook that returns the DeepTracer Logger from context. Throws with a clear error message if used outside a `<DeepTracerProvider>`.

```tsx
import { useLogger } from "@deeptracer/react"

function MyComponent() {
  const logger = useLogger()

  async function handleSubmit() {
    try {
      await submitData()
      logger.info("Form submitted successfully")
    } catch (error) {
      logger.captureError(error, { severity: "high" })
    }
  }

  return <button onClick={handleSubmit}>Submit</button>
}
```

## Re-exported from @deeptracer/browser

All exports from `@deeptracer/browser` and `@deeptracer/core` are available directly from this package. You do not need to install them separately.

## Monorepo

This package is part of the [DeepTracer JavaScript SDK](https://github.com/getdeeptracer/deeptracer-js) monorepo:

| Package | Description |
|---------|-------------|
| [`@deeptracer/core`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/core) | Zero-dependency shared core |
| [`@deeptracer/node`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/node) | Node.js/Bun SDK |
| [`@deeptracer/ai`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/ai) | AI SDK wrappers |
| [`@deeptracer/browser`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/browser) | Browser SDK |
| **`@deeptracer/react`** | React integration (this package) |
| [`@deeptracer/nextjs`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/nextjs) | Next.js integration |

## Links

- [deeptracer.dev](https://deeptracer.dev) — Homepage
- [Docs](https://deeptracer.dev/docs) — Documentation
- [GitHub](https://github.com/getdeeptracer/deeptracer-js) — Source code

## License

MIT
