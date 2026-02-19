import type { Context } from "@opentelemetry/api"
import type { ReadableSpan, SpanProcessor } from "@opentelemetry/sdk-trace-base"
import type { SpanData, BeforeSendEvent, LoggerConfig } from "@deeptracer/core"
import { Transport } from "@deeptracer/core/internal"

// ---------------------------------------------------------------------------
// Double-registration guard (survives HMR module re-evaluation)
// ---------------------------------------------------------------------------

const REGISTERED_KEY = Symbol.for("deeptracer.otel.registered")

export function isAlreadyRegistered(): boolean {
  return (globalThis as Record<symbol, unknown>)[REGISTERED_KEY] === true
}

export function markRegistered(): void {
  ;(globalThis as Record<symbol, unknown>)[REGISTERED_KEY] = true
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** OTel runtime functions passed via constructor to avoid top-level runtime imports. */
export interface OtelRuntime {
  hrTimeToMilliseconds: (time: [number, number]) => number
  SpanStatusCode: { ERROR: number; OK: number; UNSET: number }
}

export interface ProcessorConfig {
  transportConfig: Pick<
    LoggerConfig,
    "endpoint" | "secretKey" | "publicKey" | "service" | "environment"
  >
  beforeSend?: (event: BeforeSendEvent) => BeforeSendEvent | null
  debug?: boolean
}

// ---------------------------------------------------------------------------
// SpanProcessor
// ---------------------------------------------------------------------------

/**
 * OpenTelemetry SpanProcessor that converts finished spans into DeepTracer
 * SpanData and forwards them via the existing DeepTracer Transport.
 *
 * @internal Used by `@deeptracer/nextjs` init(). Not part of the public API.
 */
export class DeepTracerSpanProcessor implements SpanProcessor {
  private transport: Transport
  private otel: OtelRuntime
  private beforeSend?: (event: BeforeSendEvent) => BeforeSendEvent | null
  private debug: boolean
  private _isShutdown = false

  constructor(config: ProcessorConfig, otel: OtelRuntime) {
    this.transport = new Transport(config.transportConfig)
    this.otel = otel
    this.beforeSend = config.beforeSend
    this.debug = config.debug ?? false
  }

  /** No-op — we only process completed spans. */
  onStart(_span: ReadableSpan, _parentContext: Context): void {}

  /** Convert finished OTel span to SpanData and send via Transport. */
  onEnd(span: ReadableSpan): void {
    if (this._isShutdown) return

    try {
      const spanData = this.convertSpan(span)
      if (!spanData) return

      if (this.beforeSend) {
        const event: BeforeSendEvent = { type: "trace", data: spanData }
        const result = this.beforeSend(event)
        if (result === null) return
        this.transport.sendTrace(result.data as SpanData)
      } else {
        this.transport.sendTrace(spanData)
      }

      if (this.debug) {
        console.debug(
          `[@deeptracer/nextjs] OTel span: ${spanData.operation} (${spanData.duration_ms.toFixed(1)}ms)`,
        )
      }
    } catch {
      // Fail gracefully — never crash the user's app
    }
  }

  async forceFlush(): Promise<void> {
    await this.transport.drain(5000)
  }

  async shutdown(): Promise<void> {
    this._isShutdown = true
    await this.transport.drain(5000)
  }

  // ---------------------------------------------------------------------------
  // Conversion
  // ---------------------------------------------------------------------------

  private convertSpan(span: ReadableSpan): SpanData | null {
    const ctx = span.spanContext()
    if (!ctx) return null

    const metadata = this.extractAttributes(span)

    return {
      trace_id: ctx.traceId,
      span_id: ctx.spanId,
      parent_span_id: span.parentSpanContext?.spanId ?? "",
      operation: span.name,
      start_time: new Date(
        this.otel.hrTimeToMilliseconds(span.startTime as [number, number]),
      ).toISOString(),
      duration_ms: this.otel.hrTimeToMilliseconds(span.duration as [number, number]),
      status: span.status?.code === this.otel.SpanStatusCode.ERROR ? "error" : "ok",
      metadata,
    }
  }

  private extractAttributes(span: ReadableSpan): Record<string, unknown> | undefined {
    const attrs = span.attributes
    if (!attrs || Object.keys(attrs).length === 0) return undefined

    const metadata: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(attrs)) {
      if (value !== undefined && value !== null) {
        metadata[key] = value
      }
    }

    if (span.status?.message) {
      metadata["otel.status_message"] = span.status.message
    }

    const scope = span.instrumentationScope
    if (scope?.name) {
      metadata["otel.scope.name"] = scope.name
    }

    return Object.keys(metadata).length > 0 ? metadata : undefined
  }
}
