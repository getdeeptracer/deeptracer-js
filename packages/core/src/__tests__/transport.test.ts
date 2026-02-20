import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Transport } from "../transport"
import type { LogEntry } from "../types"

function createTransport(overrides?: Partial<{ endpoint: string; apiKey: string }>) {
  return new Transport({
    endpoint: "https://test.deeptracer.dev",
    apiKey: "dt_test",
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
      expect(headers.Authorization).toBe("Bearer dt_test")
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
    it("uses apiKey for Authorization header", async () => {
      const transport = createTransport({ apiKey: "dt_my_key" })
      await transport.sendLogs([])

      const [, init] = (fetch as any).mock.calls[0]
      expect(init.headers.Authorization).toBe("Bearer dt_my_key")
    })
  })

  describe("disabled mode", () => {
    it("does not send when no key is configured", async () => {
      const transport = new Transport({
        endpoint: "https://test.deeptracer.dev",
        apiKey: undefined,
        service: "test",
        environment: "test",
      })

      await transport.sendLogs([{ timestamp: "t", level: "info", message: "hi" }])
      await transport.sendError({ error_message: "boom", stack_trace: "", severity: "high" })
      await transport.sendTrace({
        trace_id: "t1",
        span_id: "s1",
        parent_span_id: "",
        operation: "test",
        start_time: "t",
        duration_ms: 100,
        status: "ok",
      })

      expect(fetch).not.toHaveBeenCalled()
    })

    it("does not send when no endpoint is configured", async () => {
      const transport = new Transport({
        endpoint: undefined as any,
        apiKey: "dt_test",
        service: "test",
        environment: "test",
      })

      await transport.sendLogs([{ timestamp: "t", level: "info", message: "hi" }])
      expect(fetch).not.toHaveBeenCalled()
    })
  })

  describe("warn-once behavior", () => {
    it("warns only once for repeated failures of the same type", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status: 500 })),
      )

      const transport = createTransport()

      // First send — should warn
      const p1 = transport.sendLogs([])
      await vi.advanceTimersByTimeAsync(10000)
      await p1

      // Second send — should NOT warn again
      const p2 = transport.sendLogs([])
      await vi.advanceTimersByTimeAsync(10000)
      await p2

      const logWarnings = warnSpy.mock.calls.filter(
        (args) => typeof args[0] === "string" && args[0].includes("Failed to send logs"),
      )
      expect(logWarnings).toHaveLength(1)

      warnSpy.mockRestore()
    })

    it("warns again after a successful send (endpoint recovered)", async () => {
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
      let shouldFail = true
      vi.stubGlobal(
        "fetch",
        vi.fn(async () => new Response(null, { status: shouldFail ? 500 : 200 })),
      )

      const transport = createTransport()

      // First send — fails, warns
      const p1 = transport.sendLogs([])
      await vi.advanceTimersByTimeAsync(10000)
      await p1

      // Endpoint recovers
      shouldFail = false
      await transport.sendLogs([])

      // Endpoint fails again — should warn again (recovered in between)
      shouldFail = true
      const p3 = transport.sendLogs([])
      await vi.advanceTimersByTimeAsync(10000)
      await p3

      const logWarnings = warnSpy.mock.calls.filter(
        (args) => typeof args[0] === "string" && args[0].includes("Failed to send logs"),
      )
      expect(logWarnings).toHaveLength(2)

      warnSpy.mockRestore()
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
          () =>
            new Promise<Response>((resolve) => {
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
