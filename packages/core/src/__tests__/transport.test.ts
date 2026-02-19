import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Transport } from "../transport"
import type { LogEntry } from "../types"

function createTransport(overrides?: Partial<{ endpoint: string; secretKey: string; publicKey: string }>) {
  return new Transport({
    endpoint: "https://test.deeptracer.dev",
    secretKey: "dt_secret_test",
    service: "test-svc",
    environment: "test",
    ...overrides,
  })
}

describe("Transport", () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(null, { status: 200 })),
    )
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe("sendLogs", () => {
    it("sends POST to /ingest/logs with correct body", async () => {
      const transport = createTransport()
      const logs: LogEntry[] = [{ timestamp: "t", level: "info", message: "hi" }]

      await transport.sendLogs(logs)

      expect(fetch).toHaveBeenCalledOnce()
      const [url, init] = (fetch as any).mock.calls[0]
      expect(url).toBe("https://test.deeptracer.dev/ingest/logs")
      expect(init.method).toBe("POST")

      const body = JSON.parse(init.body)
      expect(body.service).toBe("test-svc")
      expect(body.environment).toBe("test")
      expect(body.logs).toEqual(logs)
    })

    it("includes Authorization header with Bearer token", async () => {
      const transport = createTransport()
      await transport.sendLogs([])

      const [, init] = (fetch as any).mock.calls[0]
      const headers = init.headers
      expect(headers.Authorization).toBe("Bearer dt_secret_test")
    })

    it("includes x-deeptracer-sdk header", async () => {
      const transport = createTransport()
      await transport.sendLogs([])

      const [, init] = (fetch as any).mock.calls[0]
      expect(init.headers["x-deeptracer-sdk"]).toMatch(/^core\//)
    })
  })

  describe("sendError", () => {
    it("sends POST to /ingest/errors", async () => {
      const transport = createTransport()
      await transport.sendError({
        error_message: "boom",
        stack_trace: "",
        severity: "high",
      })

      const [url] = (fetch as any).mock.calls[0]
      expect(url).toBe("https://test.deeptracer.dev/ingest/errors")
    })
  })

  describe("sendTrace", () => {
    it("sends POST to /ingest/traces", async () => {
      const transport = createTransport()
      await transport.sendTrace({
        trace_id: "t1",
        span_id: "s1",
        parent_span_id: "",
        operation: "test",
        start_time: "t",
        duration_ms: 100,
        status: "ok",
      })

      const [url] = (fetch as any).mock.calls[0]
      expect(url).toBe("https://test.deeptracer.dev/ingest/traces")
    })
  })

  describe("sendLLMUsage", () => {
    it("sends POST to /ingest/llm", async () => {
      const transport = createTransport()
      await transport.sendLLMUsage({
        model: "gpt-4",
        provider: "openai",
        operation: "chat",
        input_tokens: 10,
        output_tokens: 20,
        cost_usd: 0.01,
        latency_ms: 500,
      })

      const [url] = (fetch as any).mock.calls[0]
      expect(url).toBe("https://test.deeptracer.dev/ingest/llm")
    })
  })

  describe("retry logic", () => {
    it("does NOT retry on 4xx", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status: 400 })),
      )
      const transport = createTransport()
      await transport.sendLogs([])

      expect(fetch).toHaveBeenCalledOnce()
    })

    it("retries on 5xx", async () => {
      let callCount = 0
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          callCount++
          if (callCount <= 2) return new Response(null, { status: 500 })
          return new Response(null, { status: 200 })
        }),
      )

      const transport = createTransport()
      const promise = transport.sendLogs([])

      // Advance through retry delays (1s + 2s + margin)
      await vi.advanceTimersByTimeAsync(1500)
      await vi.advanceTimersByTimeAsync(3000)

      await promise
      expect(callCount).toBe(3) // initial + 2 retries, third succeeds
    })

    it("retries on network error", async () => {
      let callCount = 0
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => {
          callCount++
          if (callCount <= 1) throw new Error("network error")
          return new Response(null, { status: 200 })
        }),
      )

      const transport = createTransport()
      const promise = transport.sendLogs([])

      await vi.advanceTimersByTimeAsync(1500)
      await promise
      expect(callCount).toBe(2)
    })

    it("gives up after max retries", async () => {
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status: 500 })),
      )

      const transport = createTransport()
      const promise = transport.sendLogs([])

      // Advance through all retry delays
      await vi.advanceTimersByTimeAsync(10000)
      await promise

      // 1 initial + 3 retries = 4 total
      expect(fetch).toHaveBeenCalledTimes(4)
    })
  })

  describe("auth key resolution", () => {
    it("prefers secretKey over publicKey", async () => {
      const transport = createTransport({ secretKey: "dt_secret_s", publicKey: "dt_public_p" })
      await transport.sendLogs([])

      const [, init] = (fetch as any).mock.calls[0]
      expect(init.headers.Authorization).toBe("Bearer dt_secret_s")
    })

    it("falls back to publicKey when no secretKey", async () => {
      const transport = createTransport({ secretKey: undefined, publicKey: "dt_public_p" })
      await transport.sendLogs([])

      const [, init] = (fetch as any).mock.calls[0]
      expect(init.headers.Authorization).toBe("Bearer dt_public_p")
    })
  })

  describe("drain", () => {
    it("resolves immediately when no in-flight requests", async () => {
      const transport = createTransport()
      await transport.drain()
      // No error = pass
    })

    it("waits for in-flight requests to complete", async () => {
      let resolveRequest: () => void
      vi.stubGlobal(
        "fetch",
        vi.fn(
          () => new Promise<Response>((resolve) => {
            resolveRequest = () => resolve(new Response(null, { status: 200 }))
          }),
        ),
      )

      const transport = createTransport()
      transport.sendLogs([]) // starts in-flight request

      let drained = false
      const drainPromise = transport.drain(5000).then(() => {
        drained = true
      })

      // Not drained yet
      await vi.advanceTimersByTimeAsync(100)
      expect(drained).toBe(false)

      // Resolve the in-flight request
      resolveRequest!()
      await drainPromise
      expect(drained).toBe(true)
    })
  })
})
