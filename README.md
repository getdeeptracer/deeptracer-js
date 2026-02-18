<p align="center">
  <a href="https://deeptracer.dev">
    <img src="https://deeptracer.dev/logo.svg" alt="DeepTracer" width="120" />
  </a>
</p>

<h1 align="center">DeepTracer JavaScript SDK</h1>

<p align="center">
  AI-first observability for vibe coders — logs, errors, traces, and LLM usage tracking.
  <br />
  <a href="https://deeptracer.dev"><strong>deeptracer.dev</strong></a> · <a href="https://deeptracer.dev/docs">Docs</a> · <a href="https://github.com/getdeeptracer/deeptracer-js/issues">Issues</a>
</p>

<p align="center">
  <a href="https://www.npmjs.com/package/@deeptracer/node"><img src="https://img.shields.io/npm/v/@deeptracer/node?label=%40deeptracer%2Fnode&color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@deeptracer/ai"><img src="https://img.shields.io/npm/v/@deeptracer/ai?label=%40deeptracer%2Fai&color=blue" alt="npm" /></a>
  <a href="https://www.npmjs.com/package/@deeptracer/core"><img src="https://img.shields.io/npm/v/@deeptracer/core?label=%40deeptracer%2Fcore&color=blue" alt="npm" /></a>
  <a href="/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
</p>

---

Built for **vibe coders and AI-assisted development** — sensible defaults, automatic error capture, and one-liner integrations.

## Packages

| Package | Description | Status |
|---------|-------------|--------|
| [`@deeptracer/core`](./packages/core) | Shared types, Logger, transport, tracing | Stable |
| [`@deeptracer/node`](./packages/node) | Node.js/Bun SDK — global errors, console capture, Hono & Express middleware | Stable |
| [`@deeptracer/ai`](./packages/ai) | AI SDK wrappers — Vercel AI, OpenAI, Anthropic | Stable |
| [`@deeptracer/browser`](./packages/browser) | Browser SDK — window error capture | Preview |
| [`@deeptracer/react`](./packages/react) | React integration — error boundaries, hooks | Coming Soon |
| [`@deeptracer/nextjs`](./packages/nextjs) | Next.js integration — middleware, server components | Coming Soon |

## Quick Start (Node.js / Bun)

```bash
npm install @deeptracer/node @deeptracer/ai
```

```ts
import { init, honoMiddleware } from "@deeptracer/node"
import { wrapVercelAI } from "@deeptracer/ai"
import { generateText } from "ai"
import { openai } from "@ai-sdk/openai"

// 1. Initialize — creates logger + captures uncaught errors
const logger = init({
  product: "my-app",
  service: "api",
  environment: "production",
  endpoint: "https://your-deeptracer.com",
  apiKey: "dt_live_xxx",
})

// 2. Add middleware to your framework
app.use(honoMiddleware(logger))

// 3. Wrap AI SDK for automatic LLM tracking
const ai = wrapVercelAI(logger, { generateText })
const { text } = await ai.generateText({
  model: openai("gpt-4o"),
  prompt: "Hello!",
})
```

## Architecture

```
@deeptracer/core        ← zero dependencies, shared by all packages
    ↑
@deeptracer/node        ← Node.js/Bun: process errors, middleware
@deeptracer/browser     ← Browser: window errors, fetch interceptor
@deeptracer/ai          ← AI SDK wrappers (works in any JS runtime)
    ↑
@deeptracer/react       ← React error boundary, hooks
@deeptracer/nextjs      ← Next.js server + client instrumentation
```

All platform packages (`node`, `browser`) re-export everything from `core`, so you only need to import from one package.

## Features

- **Structured Logging** — batched, leveled (debug/info/warn/error), with metadata and context
- **Error Tracking** — automatic global capture + manual `captureError()` with severity and breadcrumbs
- **Distributed Tracing** — callback-based `startSpan()` (auto-ends) + manual `startInactiveSpan()` + `wrap()` decorator
- **LLM Usage Monitoring** — automatic tracking for Vercel AI SDK, OpenAI, and Anthropic
- **Framework Middleware** — one-liner for Hono and Express (auto-traces every request)
- **Console Capture** — forward `console.*` calls to DeepTracer
- **Zero Dependencies** — core has no runtime dependencies

## Development

```bash
# Install dependencies
npm install

# Build all packages (in dependency order)
npm run build

# Clean all dist folders
npm run clean
```

## Links

- [deeptracer.dev](https://deeptracer.dev) — Homepage
- [Docs](https://deeptracer.dev/docs) — Documentation
- [Dashboard](https://deeptracer.dev/dashboard) — Sign in
- [GitHub](https://github.com/getdeeptracer/deeptracer-js) — Source code
- [Issues](https://github.com/getdeeptracer/deeptracer-js/issues) — Bug reports & feature requests

## License

MIT
