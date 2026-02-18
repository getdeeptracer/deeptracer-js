import type { Logger } from "@deeptracer/core"

/**
 * Wrap an Anthropic client instance with automatic LLM usage tracking.
 * Intercepts messages.create() and messages.stream() for both streaming and non-streaming.
 *
 * @param logger - DeepTracer logger instance
 * @param client - Anthropic client instance (new Anthropic())
 * @returns The same client, with tracking added
 *
 * @example
 * ```ts
 * import { createLogger } from "@deeptracer/node"
 * import { wrapAnthropic } from "@deeptracer/ai"
 * import Anthropic from "@anthropic-ai/sdk"
 *
 * const logger = createLogger({ ... })
 * const anthropic = wrapAnthropic(logger, new Anthropic())
 *
 * const message = await anthropic.messages.create({
 *   model: "claude-sonnet-4-20250514",
 *   max_tokens: 1024,
 *   messages: [{ role: "user", content: "Hello!" }],
 * })
 * ```
 */
export function wrapAnthropic<T extends Record<string, any>>(logger: Logger, client: T): T {
  const originalCreate = client.messages?.create
  if (originalCreate) {
    const boundCreate = originalCreate.bind(client.messages)

    client.messages.create = async (params: any, ...rest: any[]) => {
      const startMs = Date.now()

      if (!params.stream) {
        const result = await boundCreate(params, ...rest)
        const latencyMs = Date.now() - startMs

        logger.llmUsage({
          model: result.model || params.model || "unknown",
          provider: "anthropic",
          operation: "messages.create",
          inputTokens: result.usage?.input_tokens || 0,
          outputTokens: result.usage?.output_tokens || 0,
          latencyMs,
        })

        return result
      }

      const stream = await boundCreate(params, ...rest)
      const latencyMs = Date.now() - startMs

      if (stream && typeof stream.finalMessage === "function") {
        stream
          .finalMessage()
          .then((message: any) => {
            const totalLatencyMs = Date.now() - startMs
            logger.llmUsage({
              model: message.model || params.model || "unknown",
              provider: "anthropic",
              operation: "messages.create (stream)",
              inputTokens: message.usage?.input_tokens || 0,
              outputTokens: message.usage?.output_tokens || 0,
              latencyMs: totalLatencyMs,
            })
          })
          .catch(() => {})
      } else {
        logger.llmUsage({
          model: params.model || "unknown",
          provider: "anthropic",
          operation: "messages.create (stream)",
          inputTokens: 0,
          outputTokens: 0,
          latencyMs,
        })
      }

      return stream
    }
  }

  const originalStream = client.messages?.stream
  if (originalStream) {
    const boundStream = originalStream.bind(client.messages)

    client.messages.stream = (params: any, ...rest: any[]) => {
      const startMs = Date.now()
      const stream = boundStream(params, ...rest)

      if (stream && typeof stream.finalMessage === "function") {
        const originalFinalMessage = stream.finalMessage.bind(stream)
        let tracked = false

        stream.finalMessage = async () => {
          const message = await originalFinalMessage()
          if (!tracked) {
            tracked = true
            const latencyMs = Date.now() - startMs
            logger.llmUsage({
              model: message.model || params.model || "unknown",
              provider: "anthropic",
              operation: "messages.stream",
              inputTokens: message.usage?.input_tokens || 0,
              outputTokens: message.usage?.output_tokens || 0,
              latencyMs,
            })
          }
          return message
        }

        if (typeof stream.on === "function") {
          stream.on("finalMessage", (message: any) => {
            if (!tracked) {
              tracked = true
              const latencyMs = Date.now() - startMs
              logger.llmUsage({
                model: message.model || params.model || "unknown",
                provider: "anthropic",
                operation: "messages.stream",
                inputTokens: message.usage?.input_tokens || 0,
                outputTokens: message.usage?.output_tokens || 0,
                latencyMs,
              })
            }
          })
        }
      }

      return stream
    }
  }

  return client
}
