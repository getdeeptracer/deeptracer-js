import type { LogEntry, LoggerConfig, ErrorReport, SpanData } from "./types"

export class Transport {
  constructor(
    private config: Pick<
      LoggerConfig,
      "endpoint" | "apiKey" | "product" | "service" | "environment"
    >,
  ) {}

  async sendLogs(logs: LogEntry[]): Promise<void> {
    try {
      const res = await fetch(`${this.config.endpoint}/ingest/logs`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          product: this.config.product,
          service: this.config.service,
          environment: this.config.environment,
          logs,
        }),
      })
      if (!res.ok) {
        console.warn(
          `[@deeptracer/core] Failed to send logs: ${res.status} ${res.statusText}`,
        )
      }
    } catch {
      console.warn(
        "[@deeptracer/core] Failed to send logs, falling back to console",
      )
    }
  }

  async sendError(error: ErrorReport): Promise<void> {
    try {
      const res = await fetch(`${this.config.endpoint}/ingest/errors`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          ...error,
          product: this.config.product,
          service: this.config.service,
          environment: this.config.environment,
        }),
      })
      if (!res.ok) {
        console.warn(
          `[@deeptracer/core] Failed to send error: ${res.status} ${res.statusText}`,
        )
      }
    } catch {
      console.warn("[@deeptracer/core] Failed to send error report")
      console.error(error.error_message)
    }
  }

  async sendTrace(span: SpanData): Promise<void> {
    try {
      const res = await fetch(`${this.config.endpoint}/ingest/traces`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          ...span,
          product: this.config.product,
          service: this.config.service,
          environment: this.config.environment,
        }),
      })
      if (!res.ok) {
        console.warn(
          `[@deeptracer/core] Failed to send trace: ${res.status} ${res.statusText}`,
        )
      }
    } catch {
      console.warn("[@deeptracer/core] Failed to send trace span")
    }
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
    try {
      const res = await fetch(`${this.config.endpoint}/ingest/llm`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify({
          ...report,
          product: this.config.product,
          service: this.config.service,
          environment: this.config.environment,
        }),
      })
      if (!res.ok) {
        console.warn(
          `[@deeptracer/core] Failed to send LLM usage: ${res.status} ${res.statusText}`,
        )
      }
    } catch {
      console.warn("[@deeptracer/core] Failed to send LLM usage report")
    }
  }
}
