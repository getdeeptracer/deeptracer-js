import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { createLogger, resolveRelease } from "../logger"
import { testConfig, mockFetch } from "./helpers"
import type { LoggerConfig } from "../types"

describe("resolveRelease", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns config.release when set explicitly", () => {
    const config: LoggerConfig = { ...testConfig(), release: "v1.2.3" }
    expect(resolveRelease(config)).toBe("v1.2.3")
  })

  it("prefers config.release over env vars", () => {
    vi.stubEnv("DEEPTRACER_RELEASE", "env-release")
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc123")
    const config: LoggerConfig = { ...testConfig(), release: "explicit" }
    expect(resolveRelease(config)).toBe("explicit")
  })

  it("reads DEEPTRACER_RELEASE first when no config.release", () => {
    vi.stubEnv("DEEPTRACER_RELEASE", "from-deeptracer")
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "vercel-sha")
    expect(resolveRelease(testConfig())).toBe("from-deeptracer")
  })

  it("reads VERCEL_GIT_COMMIT_SHA when DEEPTRACER_RELEASE is not set", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "vercel-sha-abc")
    expect(resolveRelease(testConfig())).toBe("vercel-sha-abc")
  })

  it("reads RAILWAY_GIT_COMMIT_SHA as fallback", () => {
    vi.stubEnv("RAILWAY_GIT_COMMIT_SHA", "railway-sha")
    expect(resolveRelease(testConfig())).toBe("railway-sha")
  })

  it("reads RENDER_GIT_COMMIT as fallback", () => {
    vi.stubEnv("RENDER_GIT_COMMIT", "render-sha")
    expect(resolveRelease(testConfig())).toBe("render-sha")
  })

  it("reads FLY_IMAGE_REF as fallback", () => {
    vi.stubEnv("FLY_IMAGE_REF", "fly-ref")
    expect(resolveRelease(testConfig())).toBe("fly-ref")
  })

  it("reads GIT_COMMIT_SHA as fallback", () => {
    vi.stubEnv("GIT_COMMIT_SHA", "generic-sha")
    expect(resolveRelease(testConfig())).toBe("generic-sha")
  })

  it("reads COMMIT_SHA as last resort", () => {
    vi.stubEnv("COMMIT_SHA", "last-sha")
    expect(resolveRelease(testConfig())).toBe("last-sha")
  })

  it("returns undefined when no config.release and no env vars", () => {
    expect(resolveRelease(testConfig())).toBeUndefined()
  })
})

describe("captureError release field", () => {
  let fetchMock: ReturnType<typeof mockFetch>

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock = mockFetch()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
    vi.unstubAllEnvs()
  })

  it("includes release in error report when config.release is set", () => {
    const logger = createLogger(testConfig({ release: "v2.0.0" }))
    logger.captureError(new Error("boom"))

    const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
    expect(errorCall).toBeDefined()
    expect(errorCall!.body.release).toBe("v2.0.0")
  })

  it("includes release from env var in error report", () => {
    vi.stubEnv("VERCEL_GIT_COMMIT_SHA", "abc123def")
    const logger = createLogger(testConfig())
    logger.captureError(new Error("boom"))

    const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
    expect(errorCall).toBeDefined()
    expect(errorCall!.body.release).toBe("abc123def")
  })

  it("release is undefined in error report when not configured", () => {
    const logger = createLogger(testConfig())
    logger.captureError(new Error("boom"))

    const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
    expect(errorCall).toBeDefined()
    expect(errorCall!.body.release).toBeUndefined()
  })

  it("child loggers inherit release from parent config", () => {
    const logger = createLogger(testConfig({ release: "v3.0.0" }))
    const child = logger.withContext("child")
    child.captureError(new Error("child error"))

    const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
    expect(errorCall).toBeDefined()
    expect(errorCall!.body.release).toBe("v3.0.0")
  })

  it("forRequest child logger inherits release", () => {
    const logger = createLogger(testConfig({ release: "v4.0.0" }))
    const request = new Request("https://example.com/api/test")
    const child = logger.forRequest(request)
    child.captureError(new Error("request error"))

    const errorCall = fetchMock.calls.find((c) => c.url.includes("/ingest/errors"))
    expect(errorCall).toBeDefined()
    expect(errorCall!.body.release).toBe("v4.0.0")
  })
})
