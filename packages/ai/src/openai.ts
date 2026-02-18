import type { Logger } from "@deeptracer/core"

/**
 * Wrap an OpenAI client instance with automatic LLM usage tracking.
 * Intercepts chat.completions.create() for both streaming and non-streaming.
 *
 * @param logger - DeepTracer logger instance
 * @param client - OpenAI client instance (new OpenAI())
 * @returns The same client, with tracking added
 *
 * @example
 * ```ts
 * import { createLogger } from "@deeptracer/node"
 * import { wrapOpenAI } from "@deeptracer/ai"
 * import OpenAI from "openai"
 *
 * const logger = createLogger({ ... })
 * const openai = wrapOpenAI(logger, new OpenAI())
 *
 * const response = await openai.chat.completions.create({
 *   model: "gpt-4o",
 *   messages: [{ role: "user", content: "Hello!" }],
 * })
 * ```
 */
export function wrapOpenAI<T extends Record<string, any>>(logger: Logger, client: T): T {
  const originalCreate = client.chat?.completions?.create
  if (!originalCreate) return client

  const boundCreate = originalCreate.bind(client.chat.completions)

  client.chat.completions.create = async (params: any, ...rest: any[]) => {
    const startMs = Date.now()

    if (!params.stream) {
      const result = await boundCreate(params, ...rest)
      const latencyMs = Date.now() - startMs

      logger.llmUsage({
        model: result.model || params.model || "unknown",
        provider: "openai",
        operation: "chat.completions.create",
        inputTokens: result.usage?.prompt_tokens || 0,
        outputTokens: result.usage?.completion_tokens || 0,
        latencyMs,
      })

      return result
    }

    const stream = await boundCreate(params, ...rest)

    const originalIterator = stream[Symbol.asyncIterator]?.bind(stream)
    if (!originalIterator) return stream

    let usageData: any = null

    stream[Symbol.asyncIterator] = async function* () {
      for await (const chunk of originalIterator()) {
        if (chunk.usage) {
          usageData = chunk.usage
        }
        yield chunk
      }

      const latencyMs = Date.now() - startMs
      logger.llmUsage({
        model: params.model || "unknown",
        provider: "openai",
        operation: "chat.completions.create (stream)",
        inputTokens: usageData?.prompt_tokens || 0,
        outputTokens: usageData?.completion_tokens || 0,
        latencyMs,
      })
    }

    return stream
  }

  return client
}
