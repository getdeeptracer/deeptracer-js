# @deeptracer/browser

[![npm](https://img.shields.io/npm/v/@deeptracer/browser?color=blue)](https://www.npmjs.com/package/@deeptracer/browser)

DeepTracer SDK for browsers — window error handlers and console capture. Re-exports everything from `@deeptracer/core`.

> **Most users should install [`@deeptracer/react`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/react) or [`@deeptracer/nextjs`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/nextjs) instead.** This package is the low-level browser runtime used internally by those packages.

## Installation

```bash
npm install @deeptracer/browser
```

## Quick Start

```ts
import { createLogger, captureGlobalErrors } from "@deeptracer/browser"

const logger = createLogger({
  service: "web",
  environment: "production",
  endpoint: "https://deeptracer.example.com",
  publicKey: "dt_public_xxx",
})

// Capture all unhandled errors and promise rejections
captureGlobalErrors(logger)

// Log events
logger.info("Page loaded", { route: "/dashboard" })
```

## API Reference

### `captureGlobalErrors(logger)`

Automatically capture unhandled errors and promise rejections via `window.addEventListener("error")` and `window.addEventListener("unhandledrejection")`.

- Uncaught exceptions: reported with severity `"critical"`
- Unhandled rejections: reported with severity `"high"`

```ts
import { createLogger, captureGlobalErrors } from "@deeptracer/browser"

const logger = createLogger({ ... })
captureGlobalErrors(logger)
```

### `captureConsole(logger)`

Intercept all `console.log/info/warn/error/debug` calls and forward them to DeepTracer as log entries. Original console output is preserved.

```ts
import { createLogger, captureConsole } from "@deeptracer/browser"

const logger = createLogger({ ... })
captureConsole(logger)

// console.log("hello") → goes to BOTH console AND DeepTracer
```

### Re-exported from @deeptracer/core

All public exports from `@deeptracer/core` are available directly:

- `createLogger(config)` — create a Logger instance
- `Logger` class — debug, info, warn, error, captureError, startSpan, setUser, setTags, setContext, addBreadcrumb, flush, destroy
- Types: `LoggerConfig`, `LogLevel`, `LogEntry`, `ErrorReport`, `LLMUsageReport`, `Span`, `InactiveSpan`, `SpanData`, `MiddlewareOptions`, `User`, `Breadcrumb`, `BeforeSendEvent`
- Constants: `SDK_VERSION`, `SDK_NAME`

See the [`@deeptracer/core` README](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/core) for full documentation.

## Monorepo

This package is part of the [DeepTracer JavaScript SDK](https://github.com/getdeeptracer/deeptracer-js) monorepo:

| Package | Description |
|---------|-------------|
| [`@deeptracer/core`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/core) | Zero-dependency shared core |
| [`@deeptracer/node`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/node) | Node.js/Bun SDK |
| [`@deeptracer/ai`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/ai) | AI SDK wrappers |
| **`@deeptracer/browser`** | Browser SDK (this package) |
| [`@deeptracer/react`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/react) | React integration |
| [`@deeptracer/nextjs`](https://github.com/getdeeptracer/deeptracer-js/tree/main/packages/nextjs) | Next.js integration |

## Links

- [deeptracer.dev](https://deeptracer.dev) — Homepage
- [Docs](https://deeptracer.dev/docs) — Documentation
- [GitHub](https://github.com/getdeeptracer/deeptracer-js) — Source code

## License

MIT
