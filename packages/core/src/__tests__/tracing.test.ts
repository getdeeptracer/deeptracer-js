import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createLogger } from "../logger"
import { testConfig, mockFetch } from "./helpers"

describe("Tracing", () => {
  let fetchMock: ReturnType<typeof mockFetch>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = mockFetch()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  describe("startSpan (callback-based)", () => {
    it("executes the callback and returns its value", () => {
      const logger = createLogger(testConfig())
      const result = logger.startSpan("test-op", () => 42)
      expect(result).toBe(42)
    })

    it("sends trace span to transport on completion", () => {
      const logger = createLogger(testConfig())
      logger.startSpan("test-op", () => "ok")

      const traceCall = fetchMock.calls.find((c) => c.url.includes("/ingest/traces"))
      expect(traceCall).toBeDefined()
      expect(traceCall!.body.operation).toBe("test-op")
    })

    it("span has status ok on success", () => {
      const logger = createLogger(testConfig())
      logger.startSpan("test-op", () => "ok")

      const traceCall = fetchMock.calls.find((c) => c.url.includes("/ingest/traces"))
      expect(traceCall!.body.status).toBe("ok")
    })

    it("span has status error when callback throws", () => {
      const logger = createLogger(testConfig())

      expect(() => {
        logger.startSpan("failing-op", () => {
          throw new Error("fail")
        })
      }).toThrow("fail")

      const traceCall = fetchMock.calls.find((c) => c.url.includes("/ingest/traces"))
      expect(traceCall!.body.status).toBe("error")
    })

    it("handles async callbacks", async () => {
      const logger = createLogger(testConfig())
      const result = await logger.startSpan("async-op", async () => {
        return "async-result"
      })
      expect(result).toBe("async-result")

      const traceCall = fetchMock.calls.find((c) => c.url.includes("/ingest/traces"))
      expect(traceCall!.body.status).toBe("ok")
    })

    it("async: status error on rejected promise", async () => {
      const logger = createLogger(testConfig())

      await expect(
        logger.startSpan("failing-async", async () => {
          throw new Error("async fail")
        }),
      ).rejects.toThrow("async fail")

      const traceCall = fetchMock.calls.find((c) => c.url.includes("/ingest/traces"))
      expect(traceCall!.body.status).toBe("error")
    })
  })

  describe("startInactiveSpan (manual lifecycle)", () => {
    it("returns span with traceId, spanId, operation", () => {
      const logger = createLogger(testConfig())
      const span = logger.startInactiveSpan("manual-op")

      expect(span.traceId).toBeTruthy()
      expect(span.spanId).toBeTruthy()
      expect(span.operation).toBe("manual-op")
    })

    it("end() sends trace data to transport", () => {
      const logger = createLogger(testConfig())
      const span = logger.startInactiveSpan("manual-op")
      span.end()

      const traceCall = fetchMock.calls.find((c) => c.url.includes("/ingest/traces"))
      expect(traceCall).toBeDefined()
      expect(traceCall!.body.operation).toBe("manual-op")
      expect(traceCall!.body.duration_ms).toBeGreaterThanOrEqual(0)
    })

    it("duration_ms reflects elapsed time", () => {
      const logger = createLogger(testConfig())
      const span = logger.startInactiveSpan("timed-op")

      vi.advanceTimersByTime(150)
      span.end()

      const traceCall = fetchMock.calls.find((c) => c.url.includes("/ingest/traces"))
      expect(traceCall!.body.duration_ms).toBe(150)
    })

    it("parentSpanId is empty for root spans", () => {
      const logger = createLogger(testConfig())
      const span = logger.startInactiveSpan("root-op")
      span.end()

      const traceCall = fetchMock.calls.find((c) => c.url.includes("/ingest/traces"))
      expect(traceCall!.body.parent_span_id).toBe("")
    })
  })

  describe("child spans", () => {
    it("child span inherits traceId from parent", () => {
      const logger = createLogger(testConfig())
      const parent = logger.startInactiveSpan("parent-op")

      let childTraceId: string | undefined
      parent.startSpan("child-op", (span) => {
        childTraceId = span.traceId
      })
      parent.end()

      expect(childTraceId).toBe(parent.traceId)
    })

    it("child span's parentSpanId is the parent's spanId", () => {
      const logger = createLogger(testConfig())
      const parent = logger.startInactiveSpan("parent-op")

      parent.startSpan("child-op", () => {})
      parent.end()

      const traceCalls = fetchMock.calls.filter((c) => c.url.includes("/ingest/traces"))
      const childTrace = traceCalls.find((c) => c.body.operation === "child-op")
      expect(childTrace!.body.parent_span_id).toBe(parent.spanId)
    })
  })

  describe("getHeaders", () => {
    it("returns x-trace-id and x-span-id", () => {
      const logger = createLogger(testConfig())
      const span = logger.startInactiveSpan("op")
      const headers = span.getHeaders()

      expect(headers["x-trace-id"]).toBe(span.traceId)
      expect(headers["x-span-id"]).toBe(span.spanId)
    })

    it("returns W3C traceparent when traceId is 32-hex", () => {
      const logger = createLogger(testConfig())
      const span = logger.startInactiveSpan("op")
      const headers = span.getHeaders()

      // traceId should be 32-hex (generated by generateTraceId)
      expect(span.traceId).toMatch(/^[0-9a-f]{32}$/)
      expect(headers.traceparent).toBe(`00-${span.traceId}-${span.spanId}-01`)
    })
  })

  describe("wrap", () => {
    it("returns a wrapped function that traces the call", () => {
      const logger = createLogger(testConfig())
      const fn = (a: number, b: number) => a + b
      const wrapped = logger.wrap("add", fn)

      const result = wrapped(2, 3)
      expect(result).toBe(5)

      const traceCall = fetchMock.calls.find((c) => c.url.includes("/ingest/traces"))
      expect(traceCall).toBeDefined()
      expect(traceCall!.body.operation).toBe("add")
    })

    it("wrapped function traces errors", () => {
      const logger = createLogger(testConfig())
      const fn = () => {
        throw new Error("wrapped error")
      }
      const wrapped = logger.wrap("failing", fn)

      expect(() => wrapped()).toThrow("wrapped error")

      const traceCall = fetchMock.calls.find((c) => c.url.includes("/ingest/traces"))
      expect(traceCall!.body.status).toBe("error")
    })
  })
})
