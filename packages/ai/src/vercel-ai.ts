import type { Logger } from "@deeptracer/core"

/**
 * Wrap Vercel AI SDK functions with automatic LLM usage tracking.
 * Works with generateText, streamText, generateObject, streamObject.
 *
 * @param logger - DeepTracer logger instance
 * @param fns - Object containing Vercel AI SDK functions to wrap
 * @returns The same functions, wrapped with automatic LLM tracking
 *
 * @example
 * ```ts
 * import { createLogger } from "@deeptracer/node"
 * import { wrapVercelAI } from "@deeptracer/ai"
 * import { generateText, streamText } from "ai"
 * import { openai } from "@ai-sdk/openai"
 *
 * const logger = createLogger({ ... })
 * const ai = wrapVercelAI(logger, { generateText, streamText })
 *
 * const { text } = await ai.generateText({
 *   model: openai("gpt-4o"),
 *   prompt: "Hello",
 * })
 * ```
 */
export function wrapVercelAI<T extends Record<string, any>>(
  logger: Logger,
  fns: T,
): T {
  const wrapped: Record<string, any> = {}

  for (const [name, fn] of Object.entries(fns)) {
    if (typeof fn !== "function") {
      wrapped[name] = fn
      continue
    }

    if (name === "generateText" || name === "generateObject") {
      wrapped[name] = wrapVercelGenerate(logger, fn, name)
    } else if (name === "streamText" || name === "streamObject") {
      wrapped[name] = wrapVercelStream(logger, fn, name)
    } else {
      wrapped[name] = fn
    }
  }

  return wrapped as T
}

function wrapVercelGenerate(logger: Logger, fn: Function, operation: string) {
  return async (params: any, ...rest: any[]) => {
    const startMs = Date.now()
    const result = await fn(params, ...rest)
    const latencyMs = Date.now() - startMs

    const model = result?.response?.modelId
      || params?.model?.modelId
      || "unknown"
    const provider = params?.model?.provider
      || extractProviderFromModelId(model)
      || "unknown"

    logger.llmUsage({
      model,
      provider,
      operation,
      inputTokens: result?.usage?.promptTokens || 0,
      outputTokens: result?.usage?.completionTokens || 0,
      latencyMs,
    })

    return result
  }
}

function wrapVercelStream(logger: Logger, fn: Function, operation: string) {
  return (params: any, ...rest: any[]) => {
    const startMs = Date.now()
    const result = fn(params, ...rest)

    const model = params?.model?.modelId || "unknown"
    const provider = params?.model?.provider || extractProviderFromModelId(model) || "unknown"

    if (result?.usage && typeof result.usage.then === "function") {
      result.usage
        .then((usage: any) => {
          const latencyMs = Date.now() - startMs
          logger.llmUsage({
            model,
            provider,
            operation,
            inputTokens: usage?.promptTokens || 0,
            outputTokens: usage?.completionTokens || 0,
            latencyMs,
          })
        })
        .catch(() => {})
    }

    return result
  }
}

/** Try to extract provider name from a model ID string */
function extractProviderFromModelId(modelId: string): string | undefined {
  if (!modelId || modelId === "unknown") return undefined
  if (modelId.startsWith("gpt-") || modelId.startsWith("o1") || modelId.startsWith("o3") || modelId.startsWith("o4")) return "openai"
  if (modelId.startsWith("claude-")) return "anthropic"
  if (modelId.startsWith("gemini-")) return "google"
  if (modelId.startsWith("mistral") || modelId.startsWith("mixtral")) return "mistral"
  if (modelId.startsWith("llama")) return "meta"
  return undefined
}
