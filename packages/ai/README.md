# @deeptracer/ai

Automatic LLM usage tracking wrappers for the [DeepTracer JavaScript SDK](https://github.com/codeword-tech/deeptracer-js). Wraps **Vercel AI SDK**, **OpenAI**, and **Anthropic** clients to automatically capture model, token counts, latency, and provider for every LLM call -- both streaming and non-streaming.

No code changes required in your AI calls. Wrap once, track everything.

## Table of Contents

- [Installation](#installation)
- [Quick Start](#quick-start)
- [API Reference](#api-reference)
  - [wrapVercelAI(logger, fns)](#wrapvercelailogger-fns)
  - [wrapOpenAI(logger, client)](#wrapopenailogger-client)
  - [wrapAnthropic(logger, client)](#wrapanthropiclogger-client)
- [What Gets Tracked](#what-gets-tracked)
- [Streaming Support](#streaming-support)
- [Full Examples](#full-examples)
  - [Vercel AI SDK with Multiple Providers](#vercel-ai-sdk-with-multiple-providers)
  - [OpenAI Direct Client](#openai-direct-client)
  - [Anthropic Direct Client](#anthropic-direct-client)
  - [Multiple Providers in One App](#multiple-providers-in-one-app)
- [Provider Detection](#provider-detection)
- [Monorepo](#monorepo)
- [License](#license)

## Installation

```bash
npm install @deeptracer/ai @deeptracer/node
```

`@deeptracer/ai` depends on `@deeptracer/core` (included automatically). You also need whichever AI SDK you are wrapping:

```bash
# For Vercel AI SDK
npm install ai @ai-sdk/openai    # or @ai-sdk/anthropic, @ai-sdk/google, etc.

# For OpenAI directly
npm install openai

# For Anthropic directly
npm install @anthropic-ai/sdk
```

## Quick Start

```ts
import { init } from "@deeptracer/node"
import { wrapVercelAI } from "@deeptracer/ai"
import { generateText, streamText } from "ai"
import { openai } from "@ai-sdk/openai"

const logger = init({
  product: "my-app",
  service: "api",
  environment: "production",
  endpoint: "https://your-deeptracer.example.com",
  apiKey: "dt_live_xxx",
})

// Wrap Vercel AI SDK functions
const ai = wrapVercelAI(logger, { generateText, streamText })

// Use exactly as before -- tracking is automatic
const { text } = await ai.generateText({
  model: openai("gpt-4o"),
  prompt: "Explain quantum computing in one sentence.",
})
// DeepTracer automatically records: model, provider, input/output tokens, latency
```

## API Reference

### wrapVercelAI(logger, fns)

Wrap Vercel AI SDK functions with automatic LLM usage tracking. Works with `generateText`, `streamText`, `generateObject`, and `streamObject`.

```ts
import { wrapVercelAI } from "@deeptracer/ai"
import { generateText, streamText, generateObject, streamObject } from "ai"

const ai = wrapVercelAI(logger, { generateText, streamText, generateObject, streamObject })
```

**Parameters:**
- `logger: Logger` -- A DeepTracer logger instance (from `@deeptracer/node` or `@deeptracer/core`).
- `fns: T` -- An object containing Vercel AI SDK functions to wrap. Only `generateText`, `streamText`, `generateObject`, and `streamObject` are instrumented; all other properties are passed through unchanged.

**Returns:** `T` -- The same object shape with wrapped functions. Use it as a drop-in replacement.

**Supported functions:**

| Function | Tracking Method |
|----------|----------------|
| `generateText` | Tracks after the response completes. Reads `result.usage.promptTokens` and `result.usage.completionTokens`. |
| `generateObject` | Same as `generateText`. |
| `streamText` | Awaits the `result.usage` promise (resolved when the stream finishes). |
| `streamObject` | Same as `streamText`. |

**Usage with `generateText`:**

```ts
const { text } = await ai.generateText({
  model: openai("gpt-4o"),
  prompt: "Hello!",
})
```

**Usage with `streamText`:**

```ts
const result = ai.streamText({
  model: openai("gpt-4o"),
  prompt: "Write a story.",
})

// Consume the stream normally -- tracking happens after the stream finishes
for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}
```

**Usage with `generateObject`:**

```ts
import { z } from "zod"

const { object } = await ai.generateObject({
  model: openai("gpt-4o"),
  schema: z.object({
    name: z.string(),
    age: z.number(),
  }),
  prompt: "Generate a fictional character.",
})
```

---

### wrapOpenAI(logger, client)

Wrap an OpenAI client instance with automatic LLM usage tracking. Intercepts `chat.completions.create()` for both streaming and non-streaming calls.

```ts
import { wrapOpenAI } from "@deeptracer/ai"
import OpenAI from "openai"

const openai = wrapOpenAI(logger, new OpenAI())
```

**Parameters:**
- `logger: Logger` -- A DeepTracer logger instance.
- `client: T` -- An OpenAI client instance (`new OpenAI()`). The client is mutated in-place and also returned.

**Returns:** `T` -- The same client instance, with `chat.completions.create` wrapped.

**Non-streaming usage:**

```ts
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "Hello!" },
  ],
})
// Tracked: model, provider ("openai"), input/output tokens, latency
```

**Streaming usage:**

```ts
const stream = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Tell me a joke." }],
  stream: true,
})

for await (const chunk of stream) {
  process.stdout.write(chunk.choices[0]?.delta?.content || "")
}
// Usage is tracked after the stream is fully consumed
```

**What gets intercepted:**
- `client.chat.completions.create()` -- both `stream: false` (default) and `stream: true`.
- If the client does not have `chat.completions.create`, the client is returned unmodified.

**How streaming tracking works:**
The wrapper intercepts the async iterator on the stream. As chunks arrive, it watches for a `chunk.usage` field (sent by OpenAI in the final chunk when `stream_options: { include_usage: true }` is set). After the iterator is exhausted, usage is reported to DeepTracer. The operation name for streaming calls is `"chat.completions.create (stream)"`.

---

### wrapAnthropic(logger, client)

Wrap an Anthropic client instance with automatic LLM usage tracking. Intercepts both `messages.create()` and `messages.stream()`.

```ts
import { wrapAnthropic } from "@deeptracer/ai"
import Anthropic from "@anthropic-ai/sdk"

const anthropic = wrapAnthropic(logger, new Anthropic())
```

**Parameters:**
- `logger: Logger` -- A DeepTracer logger instance.
- `client: T` -- An Anthropic client instance (`new Anthropic()`). The client is mutated in-place and also returned.

**Returns:** `T` -- The same client instance, with `messages.create` and `messages.stream` wrapped.

**Non-streaming usage with `messages.create()`:**

```ts
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Hello!" }],
})
// Tracked: model, provider ("anthropic"), input/output tokens, latency
```

**Streaming with `messages.create({ stream: true })`:**

```ts
const stream = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Write a haiku." }],
  stream: true,
})
// If the stream has a finalMessage() method, usage is tracked when that resolves.
// Otherwise, usage is reported immediately with zero tokens.
```

**Streaming with `messages.stream()`:**

```ts
const stream = anthropic.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Tell me a story." }],
})

stream.on("text", (text) => process.stdout.write(text))

const finalMessage = await stream.finalMessage()
// Usage is tracked when finalMessage() resolves or when the "finalMessage" event fires.
```

**What gets intercepted:**

| Method | Operation Name | Tracking |
|--------|---------------|----------|
| `messages.create()` (non-streaming) | `"messages.create"` | After response. Reads `result.usage.input_tokens` / `output_tokens`. |
| `messages.create({ stream: true })` | `"messages.create (stream)"` | Via `stream.finalMessage()` if available. |
| `messages.stream()` | `"messages.stream"` | Via `stream.finalMessage()` or `"finalMessage"` event. De-duplicated. |

## What Gets Tracked

Every wrapped LLM call sends the following data to DeepTracer via `logger.llmUsage()`:

| Field | Description | Source |
|-------|-------------|--------|
| `model` | Model identifier (e.g., `"gpt-4o"`, `"claude-sonnet-4-20250514"`) | Response or params |
| `provider` | Provider name (e.g., `"openai"`, `"anthropic"`, `"google"`) | Params or auto-detected from model ID |
| `operation` | Operation name (e.g., `"generateText"`, `"chat.completions.create"`) | Wrapper |
| `inputTokens` | Number of input/prompt tokens | Response usage |
| `outputTokens` | Number of output/completion tokens | Response usage |
| `latencyMs` | Wall-clock time in milliseconds | Measured by wrapper |

Each call also emits an `info`-level log entry for visibility:

```
LLM call: gpt-4o (generateText)  { llm_usage: { model: "gpt-4o", provider: "openai", ... } }
```

## Streaming Support

All three wrappers support streaming. The approach varies by SDK:

| SDK | Streaming Mechanism | When Usage Is Reported |
|-----|---------------------|----------------------|
| **Vercel AI SDK** (`streamText`/`streamObject`) | Awaits `result.usage` promise | After stream completes |
| **OpenAI** (`stream: true`) | Intercepts async iterator | After iterator is exhausted |
| **Anthropic** (`stream: true` / `.stream()`) | Hooks `finalMessage()` or `"finalMessage"` event | When final message is available |

Streaming wrappers are non-blocking -- they do not interfere with the stream's output or timing. Usage data is reported asynchronously after the stream finishes.

## Full Examples

### Vercel AI SDK with Multiple Providers

```ts
import { init } from "@deeptracer/node"
import { wrapVercelAI } from "@deeptracer/ai"
import { generateText, streamText } from "ai"
import { openai } from "@ai-sdk/openai"
import { anthropic } from "@ai-sdk/anthropic"

const logger = init({
  product: "my-app",
  service: "ai-service",
  environment: "production",
  endpoint: process.env.DEEPTRACER_ENDPOINT!,
  apiKey: process.env.DEEPTRACER_API_KEY!,
})

const ai = wrapVercelAI(logger, { generateText, streamText })

// OpenAI via Vercel AI SDK
const { text: summary } = await ai.generateText({
  model: openai("gpt-4o"),
  prompt: "Summarize the history of computing.",
})

// Anthropic via Vercel AI SDK
const { text: analysis } = await ai.generateText({
  model: anthropic("claude-sonnet-4-20250514"),
  prompt: "Analyze current tech trends.",
})

// Streaming
const result = ai.streamText({
  model: openai("gpt-4o-mini"),
  prompt: "Write a short poem about APIs.",
})

for await (const chunk of result.textStream) {
  process.stdout.write(chunk)
}
```

### OpenAI Direct Client

```ts
import { init } from "@deeptracer/node"
import { wrapOpenAI } from "@deeptracer/ai"
import OpenAI from "openai"

const logger = init({
  product: "my-app",
  service: "chatbot",
  environment: "production",
  endpoint: process.env.DEEPTRACER_ENDPOINT!,
  apiKey: process.env.DEEPTRACER_API_KEY!,
})

const openai = wrapOpenAI(logger, new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}))

// Non-streaming
const response = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [
    { role: "system", content: "You are a helpful assistant." },
    { role: "user", content: "What is the capital of France?" },
  ],
})
console.log(response.choices[0].message.content)

// Streaming
const stream = await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Count to 10." }],
  stream: true,
  stream_options: { include_usage: true },  // recommended for usage tracking
})

for await (const chunk of stream) {
  const content = chunk.choices[0]?.delta?.content
  if (content) process.stdout.write(content)
}
```

### Anthropic Direct Client

```ts
import { init } from "@deeptracer/node"
import { wrapAnthropic } from "@deeptracer/ai"
import Anthropic from "@anthropic-ai/sdk"

const logger = init({
  product: "my-app",
  service: "chatbot",
  environment: "production",
  endpoint: process.env.DEEPTRACER_ENDPOINT!,
  apiKey: process.env.DEEPTRACER_API_KEY!,
})

const anthropic = wrapAnthropic(logger, new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
}))

// Non-streaming
const message = await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Explain recursion simply." }],
})
console.log(message.content[0].text)

// Streaming with messages.stream()
const stream = anthropic.messages.stream({
  model: "claude-sonnet-4-20250514",
  max_tokens: 1024,
  messages: [{ role: "user", content: "Write a limerick about TypeScript." }],
})

stream.on("text", (text) => process.stdout.write(text))

const finalMessage = await stream.finalMessage()
console.log("\n\nTokens used:", finalMessage.usage)
```

### Multiple Providers in One App

```ts
import { init } from "@deeptracer/node"
import { wrapVercelAI, wrapOpenAI, wrapAnthropic } from "@deeptracer/ai"
import { generateText } from "ai"
import { openai as aiSdkOpenai } from "@ai-sdk/openai"
import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"

const logger = init({
  product: "multi-llm-app",
  service: "orchestrator",
  environment: "production",
  endpoint: process.env.DEEPTRACER_ENDPOINT!,
  apiKey: process.env.DEEPTRACER_API_KEY!,
})

// Wrap all three SDKs
const ai = wrapVercelAI(logger, { generateText })
const openai = wrapOpenAI(logger, new OpenAI())
const anthropic = wrapAnthropic(logger, new Anthropic())

// All calls are automatically tracked in DeepTracer
// with model, provider, token counts, and latency

await ai.generateText({ model: aiSdkOpenai("gpt-4o-mini"), prompt: "Hello via Vercel AI" })

await openai.chat.completions.create({
  model: "gpt-4o",
  messages: [{ role: "user", content: "Hello via OpenAI" }],
})

await anthropic.messages.create({
  model: "claude-sonnet-4-20250514",
  max_tokens: 256,
  messages: [{ role: "user", content: "Hello via Anthropic" }],
})
```

## Provider Detection

For `wrapVercelAI`, the provider name is determined in this order:

1. `params.model.provider` (set by the Vercel AI SDK provider packages)
2. Auto-detection from the model ID string:

| Model ID prefix | Detected provider |
|-----------------|-------------------|
| `gpt-`, `o1`, `o3`, `o4` | `"openai"` |
| `claude-` | `"anthropic"` |
| `gemini-` | `"google"` |
| `mistral`, `mixtral` | `"mistral"` |
| `llama` | `"meta"` |

For `wrapOpenAI` and `wrapAnthropic`, the provider is hardcoded to `"openai"` and `"anthropic"` respectively.

## Monorepo

This package is part of the [DeepTracer JavaScript SDK](https://github.com/codeword-tech/deeptracer-js) monorepo:

| Package | Description |
|---------|-------------|
| [`@deeptracer/core`](https://github.com/codeword-tech/deeptracer-js/tree/main/packages/core) | Zero-dependency shared core |
| [`@deeptracer/node`](https://github.com/codeword-tech/deeptracer-js/tree/main/packages/node) | Node.js/Bun SDK -- global errors, console capture, Hono & Express middleware |
| **`@deeptracer/ai`** | AI SDK wrappers (this package) |
| [`@deeptracer/browser`](https://github.com/codeword-tech/deeptracer-js/tree/main/packages/browser) | Browser SDK (preview) |
| [`@deeptracer/react`](https://github.com/codeword-tech/deeptracer-js/tree/main/packages/react) | React integration (coming soon) |
| [`@deeptracer/nextjs`](https://github.com/codeword-tech/deeptracer-js/tree/main/packages/nextjs) | Next.js integration (coming soon) |

## License

MIT
