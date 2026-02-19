import type { LogEntry, LoggerConfig, ErrorReport, SpanData } from "./types"
import { SDK_VERSION, SDK_NAME } from "./version"

/**
 * HTTP transport for sending data to the DeepTracer ingestion API.
 *
 * Features:
 * - Automatic retry with exponential backoff (3 retries, 1s/2s/4s + jitter)
 * - Only retries on network errors and 5xx (not 4xx client errors)
 * - SDK version header on every request (`x-deeptracer-sdk: core/0.3.0`)
 * - In-flight request tracking for graceful shutdown via `drain()`
 */
export class Transport {
  private inFlightRequests = new Set<Promise<void>>()

  constructor(
    private config: Pick<
      LoggerConfig,
      "endpoint" | "secretKey" | "publicKey" | "service" | "environment"
    >,
  ) {
    // Loud warning if a secret key is used in a browser context
    if (config.secretKey?.startsWith("dt_secret_") && typeof globalThis.window !== "undefined") {
      console.error(
        "[@deeptracer/core] WARNING: `secretKey` (dt_secret_...) detected in a browser bundle. " +
          "This exposes your server key to end users. Use `publicKey` (dt_public_...) for client-side code.",
      )
    }
  }

  /** Resolve the auth key: prefer secretKey (server), fall back to publicKey (client). */
  private get authKey(): string {
    return this.config.secretKey ?? this.config.publicKey ?? ""
  }

  /**
   * Send a request with automatic retry and exponential backoff.
   * Retries up to `maxRetries` times on network errors and 5xx responses.
   * Does NOT retry on 4xx (client errors — bad payload, auth failure, etc.).
   */
  private async sendWithRetry(
    url: string,
    body: unknown,
    label: string,
    maxRetries = 3,
  ): Promise<void> {
    const baseDelays = [1000, 2000, 4000]

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${this.authKey}`,
            "x-deeptracer-sdk": `${SDK_NAME}/${SDK_VERSION}`,
          },
          body: JSON.stringify(body),
        })

        if (res.ok) return

        // 4xx: client error, do not retry
        if (res.status >= 400 && res.status < 500) {
          console.warn(
            `[@deeptracer/core] Failed to send ${label}: ${res.status} ${res.statusText}`,
          )
          return
        }

        // 5xx: server error, retry if attempts remain
        if (attempt < maxRetries) {
          await this.sleep(this.jitter(baseDelays[attempt]))
          continue
        }

        console.warn(
          `[@deeptracer/core] Failed to send ${label}: ${res.status} ${res.statusText} (exhausted ${maxRetries} retries)`,
        )
      } catch {
        // Network error, retry if attempts remain
        if (attempt < maxRetries) {
          await this.sleep(this.jitter(baseDelays[attempt]))
          continue
        }
        console.warn(`[@deeptracer/core] Failed to send ${label} (exhausted ${maxRetries} retries)`)
      }
    }
  }

  /** Add +/- 20% jitter to a delay to prevent thundering herd. */
  private jitter(ms: number): number {
    const factor = 0.8 + Math.random() * 0.4
    return Math.round(ms * factor)
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }

  /** Track an in-flight request and remove it when done. */
  private track(promise: Promise<void>): void {
    this.inFlightRequests.add(promise)
    promise.finally(() => this.inFlightRequests.delete(promise))
  }

  async sendLogs(logs: LogEntry[]): Promise<void> {
    const p = this.sendWithRetry(
      `${this.config.endpoint}/ingest/logs`,
      {
        service: this.config.service,
        environment: this.config.environment,
        logs,
      },
      "logs",
    )
    this.track(p)
    return p
  }

  async sendError(error: ErrorReport): Promise<void> {
    const p = this.sendWithRetry(
      `${this.config.endpoint}/ingest/errors`,
      {
        ...error,
        service: this.config.service,
        environment: this.config.environment,
      },
      "error",
    )
    this.track(p)
    return p
  }

  async sendTrace(span: SpanData): Promise<void> {
    const p = this.sendWithRetry(
      `${this.config.endpoint}/ingest/traces`,
      {
        ...span,
        service: this.config.service,
        environment: this.config.environment,
      },
      "trace",
    )
    this.track(p)
    return p
  }

  async sendLLMUsage(report: {
    model: string
    provider: string
    operation: string
    input_tokens: number
    output_tokens: number
    cost_usd: number
    latency_ms: number
    metadata?: Record<string, unknown>
  }): Promise<void> {
    const p = this.sendWithRetry(
      `${this.config.endpoint}/ingest/llm`,
      {
        ...report,
        service: this.config.service,
        environment: this.config.environment,
      },
      "LLM usage",
    )
    this.track(p)
    return p
  }

  /**
   * Wait for all in-flight requests to complete, with a timeout.
   * Used by `logger.destroy()` to ensure data is sent before process exit.
   *
   * @param timeoutMs - Maximum time to wait (default: 2000ms)
   */
  async drain(timeoutMs = 2000): Promise<void> {
    if (this.inFlightRequests.size === 0) return
    const allDone = Promise.all(this.inFlightRequests).then(() => {})
    const timeout = new Promise<void>((resolve) => setTimeout(resolve, timeoutMs))
    await Promise.race([allDone, timeout])
  }
}
