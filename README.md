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
  <a href="https://github.com/getdeeptracer/deeptracer-js/actions/workflows/ci.yml"><img src="https://github.com/getdeeptracer/deeptracer-js/actions/workflows/ci.yml/badge.svg" alt="CI" /></a>
  <a href="https://codecov.io/gh/getdeeptracer/deeptracer-js"><img src="https://codecov.io/gh/getdeeptracer/deeptracer-js/graph/badge.svg" alt="codecov" /></a>
  <a href="https://www.npmjs.com/package/@deeptracer/core"><img src="https://img.shields.io/npm/v/@deeptracer/core?color=blue" alt="npm" /></a>
  <a href="https://bundlephobia.com/package/@deeptracer/core"><img src="https://img.shields.io/bundlephobia/minzip/@deeptracer/core" alt="bundle size" /></a>
  <a href="https://www.typescriptlang.org/"><img src="https://img.shields.io/badge/TypeScript-5.9-blue" alt="TypeScript" /></a>
  <a href="https://github.com/getdeeptracer/deeptracer-js"><img src="https://img.shields.io/badge/node-%3E%3D20-brightgreen" alt="node >= 18" /></a>
  <a href="/LICENSE"><img src="https://img.shields.io/badge/license-MIT-green" alt="MIT License" /></a>
  <a href="https://securityscorecards.dev/viewer/?uri=github.com/getdeeptracer/deeptracer-js"><img src="https://api.securityscorecards.dev/projects/github.com/getdeeptracer/deeptracer-js/badge" alt="OpenSSF Scorecard" /></a>
  <a href="https://github.com/getdeeptracer/deeptracer-js/pulls"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen" alt="PRs Welcome" /></a>
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
  service: "api",
  environment: "production",
  endpoint: "https://your-deeptracer.com",
  secretKey: "dt_secret_xxx",
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
  service: "web",
  environment: "production",
  endpoint: "https://your-deeptracer.com",
  secretKey: process.env.DEEPTRACER_SECRET_KEY!,
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

Step 1 — Install:
npm install @deeptracer/nextjs

Step 2 — Environment variables in .env.local:
DEEPTRACER_SECRET_KEY=dt_secret_xxx
DEEPTRACER_ENDPOINT=https://your-deeptracer.example.com
NEXT_PUBLIC_DEEPTRACER_KEY=dt_public_xxx
NEXT_PUBLIC_DEEPTRACER_ENDPOINT=https://your-deeptracer.example.com

Step 3 — Create instrumentation.ts in the project root:

import { init } from "@deeptracer/nextjs"

const deeptracer = init({ service: "web" })

export const { register, onRequestError } = deeptracer
export const logger = deeptracer.logger

Step 4 — Add DeepTracerProvider to app/layout.tsx (zero-config, reads env vars):

import { DeepTracerProvider } from "@deeptracer/nextjs/client"

Wrap {children} with:
<DeepTracerProvider>{children}</DeepTracerProvider>

Step 5 — Error pages:

Create app/error.tsx:
"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/nextjs/client"

Create app/global-error.tsx (same — works without a provider):
"use client"
export { DeepTracerErrorPage as default } from "@deeptracer/nextjs/client"

CRITICAL RULES:
- NEVER import @deeptracer/nextjs (without /client) from a "use client" file — it has `import "server-only"` and will fail the build with a clear error
- NEVER import a file that imports @deeptracer/nextjs from a "use client" file
- Server code: import from @deeptracer/nextjs
- Client code: import from @deeptracer/nextjs/client
- For non-React client code: import { createLogger } from "@deeptracer/nextjs/client"
- useLogger() is safe to call without a provider (returns a no-op logger during SSR/SSG)
```

</details>

<details>
<summary><strong>Add DeepTracer to my Hono / Express API</strong></summary>

```
Install @deeptracer/node and @deeptracer/ai. Set up DeepTracer observability.

1. Create a logger with init() from @deeptracer/node:

import { init, honoMiddleware } from "@deeptracer/node"

const logger = init({
  service: "api",
  environment: "production",
  endpoint: "<DEEPTRACER_ENDPOINT>",
  secretKey: process.env.DEEPTRACER_SECRET_KEY!,
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
  service: "web",
  environment: "production",
  endpoint: "<DEEPTRACER_ENDPOINT>",
  publicKey: "<DEEPTRACER_PUBLIC_KEY>",
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
  service: "api",
  environment: "production",
  endpoint: "<DEEPTRACER_ENDPOINT>",
  secretKey: process.env.DEEPTRACER_SECRET_KEY!,
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
<summary><strong>Replace console calls with structured logging</strong></summary>

```
I already have @deeptracer/nextjs set up. Replace console.log/warn/error calls
with structured DeepTracer logging across the codebase.

IMPORTANT — server vs client rules:
- Server files (API routes, Server Components, lib/ server utils, actions):
  import { logger } from "@/instrumentation"
- Client files ("use client" components, hooks, browser utils):
  DO NOT import from @/instrumentation — it will crash the build.
  Instead, use one of these:
  a) import { useLogger } from "@deeptracer/nextjs/client" (inside React components)
  b) import { createLogger } from "@deeptracer/nextjs/client" (non-React client code)
  c) Keep console.* calls (they are captured automatically if captureConsole: true)

How to identify server vs client files:
- Has "use client" directive → CLIENT
- Imported by a "use client" file (even transitively) → CLIENT
- Is a React hook (use*.ts) used in client components → CLIENT
- Everything else → SERVER

Replacement mapping:
  console.log(msg)     → logger.info(msg)
  console.info(msg)    → logger.info(msg)
  console.warn(msg)    → logger.warn(msg)
  console.error(msg)   → logger.error(msg)
  console.error(msg, err) → logger.error(msg, {}, err)

For error catches, prefer captureError:
  console.error("Failed", err) → logger.captureError(err, { severity: "high", context: { source: "..." } })
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
