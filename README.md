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
| [`@deeptracer/react`](./packages/react) | React integration — provider, error boundary, hooks | Stable |
| [`@deeptracer/nextjs`](./packages/nextjs) | Next.js integration — one-file server + client setup | Stable |

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

## Quick Start (Next.js)

```bash
npm install @deeptracer/nextjs
```

```ts
// instrumentation.ts — the only file you need to create
import { init } from "@deeptracer/nextjs"

export const { register, onRequestError } = init({
  product: "my-app",
  service: "web",
  environment: "production",
  endpoint: "https://your-deeptracer.com",
  apiKey: process.env.DEEPTRACER_API_KEY!,
})
```

All server-side errors (Server Components, Route Handlers, Middleware) are now captured automatically.

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

## Prompts for AI Agents

Copy-paste these prompts into Cursor, Claude Code, Copilot, or any AI coding assistant.

<details>
<summary><strong>Add DeepTracer to my Next.js app</strong></summary>

```
Install @deeptracer/nextjs and set up full observability for my Next.js app.

Server-side: Create instrumentation.ts in the project root with:

import { init } from "@deeptracer/nextjs"

export const { register, onRequestError } = init({
  product: "<PRODUCT_NAME>",
  service: "web",
  environment: "production",
  endpoint: "<DEEPTRACER_ENDPOINT>",
  apiKey: process.env.DEEPTRACER_API_KEY!,
})

Client-side: Add DeepTracerProvider to app/layout.tsx:

import { DeepTracerProvider } from "@deeptracer/nextjs/client"

Wrap {children} with:
<DeepTracerProvider config={{
  product: "<PRODUCT_NAME>",
  service: "web",
  environment: "production",
  endpoint: process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT!,
  apiKey: process.env.NEXT_PUBLIC_DEEPTRACER_API_KEY!,
}}>

Error boundary: Create app/global-error.tsx with:

"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/nextjs/client"

Add DEEPTRACER_API_KEY, NEXT_PUBLIC_DEEPTRACER_ENDPOINT, and NEXT_PUBLIC_DEEPTRACER_API_KEY to .env.local
```

</details>

<details>
<summary><strong>Add DeepTracer to my Hono / Express API</strong></summary>

```
Install @deeptracer/node and @deeptracer/ai. Set up DeepTracer observability.

1. Create a logger with init() from @deeptracer/node:

import { init, honoMiddleware } from "@deeptracer/node"

const logger = init({
  product: "<PRODUCT_NAME>",
  service: "api",
  environment: "production",
  endpoint: "<DEEPTRACER_ENDPOINT>",
  apiKey: process.env.DEEPTRACER_API_KEY!,
})

2. Add middleware to the app:
   - Hono: app.use(honoMiddleware(logger))
   - Express: app.use(expressMiddleware(logger))

3. If using AI/LLM calls, also install @deeptracer/ai and wrap them:
   import { wrapVercelAI } from "@deeptracer/ai"
   const ai = wrapVercelAI(logger, { generateText })

Export the logger instance so other files can import it for manual logging.
```

</details>

<details>
<summary><strong>Add error tracking to my React app</strong></summary>

```
Install @deeptracer/react. Set up error tracking for my React app.

1. Wrap the app with DeepTracerProvider in the root component:

import { DeepTracerProvider } from "@deeptracer/react"

<DeepTracerProvider config={{
  product: "<PRODUCT_NAME>",
  service: "web",
  environment: "production",
  endpoint: "<DEEPTRACER_ENDPOINT>",
  apiKey: "<DEEPTRACER_API_KEY>",
}}>
  <App />
</DeepTracerProvider>

2. Add error boundaries around critical sections:

import { DeepTracerErrorBoundary } from "@deeptracer/react"

<DeepTracerErrorBoundary fallback={<div>Something went wrong</div>}>
  <MyComponent />
</DeepTracerErrorBoundary>

3. Use the useLogger() hook in components for manual logging:

import { useLogger } from "@deeptracer/react"
const logger = useLogger()
logger.info("User clicked checkout", { cartSize: 3 })
```

</details>

<details>
<summary><strong>Add LLM usage tracking to my AI app</strong></summary>

```
Install @deeptracer/node and @deeptracer/ai. Track all LLM API calls automatically.

1. Initialize the logger:

import { init } from "@deeptracer/node"
const logger = init({
  product: "<PRODUCT_NAME>",
  service: "api",
  environment: "production",
  endpoint: "<DEEPTRACER_ENDPOINT>",
  apiKey: process.env.DEEPTRACER_API_KEY!,
})

2. Wrap your AI SDK calls:

For Vercel AI SDK:
import { wrapVercelAI } from "@deeptracer/ai"
const ai = wrapVercelAI(logger, { generateText, streamText, generateObject })
// Use ai.generateText(), ai.streamText() etc. — usage is tracked automatically

For OpenAI SDK:
import { wrapOpenAI } from "@deeptracer/ai"
const trackedClient = wrapOpenAI(logger, openaiClient)
// Use trackedClient.chat.completions.create() — usage is tracked automatically

For Anthropic SDK:
import { wrapAnthropic } from "@deeptracer/ai"
const trackedClient = wrapAnthropic(logger, anthropicClient)
// Use trackedClient.messages.create() — usage is tracked automatically

Every call automatically logs: model, provider, input/output tokens, latency, and cost.
```

</details>

<details>
<summary><strong>Wrap my Next.js Server Actions with tracing</strong></summary>

```
I already have @deeptracer/nextjs set up with instrumentation.ts.
Now wrap my Server Actions with DeepTracer tracing.

In each server action file, import withServerAction and the logger:

"use server"
import { withServerAction } from "@deeptracer/nextjs"
import { logger } from "@/instrumentation"

export async function myAction(formData: FormData) {
  return withServerAction(logger, "myAction", async () => {
    // ... existing action code
  })
}

This creates a span for each action call and automatically captures any errors.
Do this for every server action in the app.
```

</details>

<details>
<summary><strong>Wrap my Next.js Route Handlers with tracing</strong></summary>

```
I already have @deeptracer/nextjs set up with instrumentation.ts.
Now wrap my App Router Route Handlers with DeepTracer tracing.

In each route.ts file, import withRouteHandler and the logger:

import { withRouteHandler } from "@deeptracer/nextjs"
import { logger } from "@/instrumentation"

export const GET = withRouteHandler(logger, "GET /api/users", async (request) => {
  // ... existing handler code
  return Response.json(data)
})

export const POST = withRouteHandler(logger, "POST /api/users", async (request) => {
  // ... existing handler code
  return Response.json(result, { status: 201 })
})

This creates a request-scoped span, extracts trace context from headers,
and captures any errors. Do this for every route handler in the app.
```

</details>

<details>
<summary><strong>Add user context and tags to all events</strong></summary>

```
I already have DeepTracer set up. After a user logs in, I want all subsequent
logs, errors, and traces to include the user's info and custom tags.

After authentication, call:

logger.setUser({ id: user.id, email: user.email, plan: user.plan })
logger.setTags({ release: "1.2.3", region: "us-east-1" })
logger.setContext("organization", { id: org.id, name: org.name })

All events from this point forward will include this metadata.
To clear: logger.clearUser(), logger.clearTags(), logger.clearContext()
```

</details>

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
