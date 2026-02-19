import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createLogger } from "../logger"
import { testConfig, mockFetch } from "./helpers"

describe("Logger", () => {
  let fetchMock: ReturnType<typeof mockFetch>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = mockFetch()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  // Helper: flush the batcher by advancing timer past default flush interval
  async function flushAll() {
    await vi.advanceTimersByTimeAsync(6000)
  }

  describe("level filtering", () => {
    it("production environment defaults to info level", async () => {
      const logger = createLogger(testConfig({ environment: "production" }))
      logger.debug("should be filtered")
      await flushAll()
      expect(fetchMock.mock).not.toHaveBeenCalled()

      logger.info("should be sent")
      await flushAll()
      expect(fetchMock.mock).toHaveBeenCalled()

      await logger.destroy()
    })

    it("non-production environment defaults to debug level", async () => {
      const logger = createLogger(testConfig({ environment: "development" }))
      logger.debug("should be sent")
      await flushAll()
      expect(fetchMock.mock).toHaveBeenCalled()

      await logger.destroy()
    })

    it("explicit level overrides environment default", async () => {
      const logger = createLogger(testConfig({ environment: "development", level: "error" }))
      logger.warn("should be filtered")
      await flushAll()
      expect(fetchMock.mock).not.toHaveBeenCalled()

      logger.error("should be sent")
      await flushAll()
      expect(fetchMock.mock).toHaveBeenCalled()

      await logger.destroy()
    })

    it("filtered logs still record breadcrumbs", async () => {
      const logger = createLogger(testConfig({ environment: "production" }))
      logger.debug("breadcrumb only")
      logger.captureError(new Error("boom"))

      // captureError sends immediately (not batched)
      await vi.advanceTimersByTimeAsync(100)

      const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
      expect(errorCall).toBeDefined()
      expect(
        errorCall!.body.breadcrumbs.some((b: any) => b.message.includes("breadcrumb only")),
      ).toBe(true)

      await logger.destroy()
    })
  })

  describe("child isolation via withContext", () => {
    it("child logger has independent tags", () => {
      const parent = createLogger(testConfig())
      parent.setTags({ a: "1" })

      const child = parent.withContext("child")
      child.setTags({ b: "2" })

      // Parent should only have "a"
      // We can verify by capturing an error from parent and checking tags
      expect(child).not.toBe(parent)

      parent.captureError(new Error("p"))
      child.captureError(new Error("c"))

      const errors = fetchMock.calls.filter((c) => c.url.includes("/ingest/errors"))
      const parentError = errors[0]
      const childError = errors[1]

      // Tags are nested under context._tags in the error report
      expect(parentError.body.context._tags).toEqual({ a: "1" })
      expect(childError.body.context._tags).toEqual({ a: "1", b: "2" })
    })

    it("child logger has independent user", () => {
      const parent = createLogger(testConfig())
      parent.setUser({ id: "parent" })

      const child = parent.withContext("child")
      child.setUser({ id: "child" })

      parent.captureError(new Error("p"))
      child.captureError(new Error("c"))

      const errors = fetchMock.calls.filter((c) => c.url.includes("/ingest/errors"))
      expect(errors[0].body.user_id).toBe("parent")
      expect(errors[1].body.user_id).toBe("child")
    })

    it("child logger has independent breadcrumbs", () => {
      const parent = createLogger(testConfig())
      parent.info("parent breadcrumb")

      const child = parent.withContext("child")
      child.info("child breadcrumb")

      parent.captureError(new Error("p"))
      child.captureError(new Error("c"))

      const errors = fetchMock.calls.filter((c) => c.url.includes("/ingest/errors"))
      const parentBreadcrumbs = errors[0].body.breadcrumbs
      const childBreadcrumbs = errors[1].body.breadcrumbs

      // Parent should NOT have "child breadcrumb"
      expect(parentBreadcrumbs.some((b: any) => b.message.includes("child breadcrumb"))).toBe(false)
      // Child should have both (inherited parent + own)
      expect(childBreadcrumbs.some((b: any) => b.message.includes("parent breadcrumb"))).toBe(true)
      expect(childBreadcrumbs.some((b: any) => b.message.includes("child breadcrumb"))).toBe(true)
    })
  })

  describe("forRequest", () => {
    it("extracts W3C traceparent from request headers", () => {
      const parent = createLogger(testConfig())
      const request = new Request("https://example.com", {
        headers: {
          traceparent: "00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01",
        },
      })

      const child = parent.forRequest(request)
      child.captureError(new Error("test"))

      const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
      expect(errorCall!.body.trace_id).toBe("0af7651916cd43dd8448eb211c80319c")
    })

    it("falls back to custom headers", () => {
      const parent = createLogger(testConfig())
      const request = new Request("https://example.com", {
        headers: {
          "x-trace-id": "custom-trace-id",
          "x-request-id": "req-123",
        },
      })

      const child = parent.forRequest(request)
      child.captureError(new Error("test"))

      const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
      expect(errorCall!.body.trace_id).toBe("custom-trace-id")
    })

    it("returns logger with independent state", () => {
      const parent = createLogger(testConfig())
      parent.setUser({ id: "parent" })

      const request = new Request("https://example.com")
      const child = parent.forRequest(request)
      child.setUser({ id: "request-user" })

      parent.captureError(new Error("p"))
      const errors = fetchMock.calls.filter((c) => c.url.includes("/ingest/errors"))
      expect(errors[0].body.user_id).toBe("parent")
    })
  })

  describe("beforeSend hook", () => {
    it("allows modifying log events", async () => {
      const logger = createLogger(
        testConfig({
          beforeSend: (event) => {
            if (event.type === "log") {
              event.data.metadata = { ...event.data.metadata, injected: true }
            }
            return event
          },
        }),
      )

      logger.info("test")
      await flushAll()

      expect(fetchMock.calls[0].body.logs[0].metadata.injected).toBe(true)

      await logger.destroy()
    })

    it("allows dropping events by returning null", async () => {
      const logger = createLogger(
        testConfig({
          beforeSend: () => null,
        }),
      )

      logger.info("dropped")
      await flushAll()
      expect(fetchMock.mock).not.toHaveBeenCalled()

      await logger.destroy()
    })

    it("passes event through if beforeSend throws", async () => {
      const logger = createLogger(
        testConfig({
          beforeSend: () => {
            throw new Error("hook error")
          },
        }),
      )

      logger.info("should still send")
      await flushAll()
      expect(fetchMock.mock).toHaveBeenCalled()

      await logger.destroy()
    })
  })

  describe("captureError", () => {
    it("sends error report with message and stack", () => {
      const logger = createLogger(testConfig())
      const err = new Error("test error")
      logger.captureError(err)

      const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
      expect(errorCall).toBeDefined()
      expect(errorCall!.body.error_message).toBe("test error")
      expect(errorCall!.body.stack_trace).toBeTruthy()
    })

    it("includes user context when set", () => {
      const logger = createLogger(testConfig())
      logger.setUser({ id: "u123", email: "a@b.com" })
      logger.captureError(new Error("test"))

      const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
      expect(errorCall!.body.user_id).toBe("u123")
      expect(errorCall!.body.context.user).toEqual({ id: "u123", email: "a@b.com" })
    })

    it("includes tags and contexts when set", () => {
      const logger = createLogger(testConfig())
      logger.setTags({ release: "1.0" })
      logger.setContext("server", { host: "web-1" })
      logger.captureError(new Error("test"))

      const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
      expect(errorCall!.body.context._tags).toEqual({ release: "1.0" })
      expect(errorCall!.body.context._contexts).toEqual({ server: { host: "web-1" } })
    })

    it("works with non-Error values", () => {
      const logger = createLogger(testConfig())
      logger.captureError("string error")

      const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
      expect(errorCall!.body.error_message).toBe("string error")
    })
  })

  describe("setUser / clearUser", () => {
    it("clearUser removes user from metadata", () => {
      const logger = createLogger(testConfig())
      logger.setUser({ id: "u1" })
      logger.clearUser()
      logger.captureError(new Error("test"))

      const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
      expect(errorCall!.body.user_id).toBeUndefined()
    })
  })

  describe("setTags / setContext", () => {
    it("clearTags removes all tags", async () => {
      const logger = createLogger(testConfig())
      logger.setTags({ a: "1" })
      logger.clearTags()
      logger.info("test")
      await flushAll()

      const logCall = fetchMock.calls.find((c) => c.url.includes("/ingest/logs"))
      const metadata = logCall!.body.logs[0].metadata
      expect(metadata?._tags).toBeUndefined()

      await logger.destroy()
    })

    it("clearContext(name) removes specific context", async () => {
      const logger = createLogger(testConfig())
      logger.setContext("a", { x: 1 })
      logger.setContext("b", { y: 2 })
      logger.clearContext("a")
      logger.info("test")
      await flushAll()

      const logCall = fetchMock.calls.find((c) => c.url.includes("/ingest/logs"))
      const contexts = logCall!.body.logs[0].metadata?._contexts
      expect(contexts).toEqual({ b: { y: 2 } })

      await logger.destroy()
    })

    it("clearContext() removes all contexts", async () => {
      const logger = createLogger(testConfig())
      logger.setContext("a", { x: 1 })
      logger.clearContext()
      logger.info("test")
      await flushAll()

      const logCall = fetchMock.calls.find((c) => c.url.includes("/ingest/logs"))
      expect(logCall!.body.logs[0].metadata?._contexts).toBeUndefined()

      await logger.destroy()
    })
  })
})
