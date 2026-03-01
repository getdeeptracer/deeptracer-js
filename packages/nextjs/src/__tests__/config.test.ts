import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import {
  withDeepTracer,
  isUploadEnabled,
  resolveUploadRelease,
  resolveUploadEndpoint,
  resolveUploadApiKey,
} from "../config"

// ---------------------------------------------------------------------------
// Hoisted fs mock — shared across all tests that invoke the callback
// ---------------------------------------------------------------------------

const fsMocks = vi.hoisted(() => ({
  readdir: vi.fn(),
  readFile: vi.fn(),
  unlink: vi.fn(),
}))

vi.mock("node:fs/promises", () => fsMocks)

// ---------------------------------------------------------------------------
// Helper: stub env vars cleanly
// ---------------------------------------------------------------------------

function stubSourceMapEnv(overrides?: {
  CI?: string
  VERCEL?: string
  DEEPTRACER_UPLOAD_SOURCEMAPS?: string
  DEEPTRACER_RELEASE?: string
  VERCEL_GIT_COMMIT_SHA?: string
  GIT_COMMIT_SHA?: string
  DEEPTRACER_ENDPOINT?: string
  NEXT_PUBLIC_DEEPTRACER_ENDPOINT?: string
  DEEPTRACER_KEY?: string
  NEXT_PUBLIC_DEEPTRACER_KEY?: string
}) {
  for (const [key, value] of Object.entries(overrides ?? {})) {
    vi.stubEnv(key, value)
  }
}

// ---------------------------------------------------------------------------
// isUploadEnabled
// ---------------------------------------------------------------------------

describe("isUploadEnabled", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns false with no dtConfig and no env vars", () => {
    expect(isUploadEnabled()).toBe(false)
    expect(isUploadEnabled(undefined)).toBe(false)
  })

  it("returns true when uploadSourceMaps is explicitly true", () => {
    expect(isUploadEnabled({ uploadSourceMaps: true })).toBe(true)
  })

  it("returns false when uploadSourceMaps is explicitly false", () => {
    stubSourceMapEnv({ CI: "true" })
    expect(isUploadEnabled({ uploadSourceMaps: false })).toBe(false)
  })

  it("auto-enables when CI=true", () => {
    stubSourceMapEnv({ CI: "true" })
    expect(isUploadEnabled()).toBe(true)
  })

  it("auto-enables when VERCEL=1", () => {
    stubSourceMapEnv({ VERCEL: "1" })
    expect(isUploadEnabled()).toBe(true)
  })

  it("auto-enables when DEEPTRACER_UPLOAD_SOURCEMAPS=true", () => {
    stubSourceMapEnv({ DEEPTRACER_UPLOAD_SOURCEMAPS: "true" })
    expect(isUploadEnabled()).toBe(true)
  })

  it("does not auto-enable when CI is not 'true'", () => {
    stubSourceMapEnv({ CI: "false" })
    expect(isUploadEnabled()).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// resolveUploadRelease
// ---------------------------------------------------------------------------

describe("resolveUploadRelease", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("prefers dtConfig.release over env vars", () => {
    stubSourceMapEnv({ DEEPTRACER_RELEASE: "env-rel" })
    expect(resolveUploadRelease({ release: "config-rel" })).toBe("config-rel")
  })

  it("reads DEEPTRACER_RELEASE first when no config.release", () => {
    stubSourceMapEnv({ DEEPTRACER_RELEASE: "dt-rel", VERCEL_GIT_COMMIT_SHA: "vercel-sha" })
    expect(resolveUploadRelease()).toBe("dt-rel")
  })

  it("reads VERCEL_GIT_COMMIT_SHA as fallback", () => {
    stubSourceMapEnv({ VERCEL_GIT_COMMIT_SHA: "abc123" })
    expect(resolveUploadRelease()).toBe("abc123")
  })

  it("reads GIT_COMMIT_SHA as last fallback", () => {
    stubSourceMapEnv({ GIT_COMMIT_SHA: "generic-sha" })
    expect(resolveUploadRelease()).toBe("generic-sha")
  })

  it("returns undefined when nothing is set", () => {
    expect(resolveUploadRelease()).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// resolveUploadEndpoint
// ---------------------------------------------------------------------------

describe("resolveUploadEndpoint", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("prefers dtConfig.endpoint", () => {
    stubSourceMapEnv({ DEEPTRACER_ENDPOINT: "https://env.example.com" })
    expect(resolveUploadEndpoint({ endpoint: "https://config.example.com" })).toBe(
      "https://config.example.com",
    )
  })

  it("reads DEEPTRACER_ENDPOINT", () => {
    stubSourceMapEnv({ DEEPTRACER_ENDPOINT: "https://dt.example.com" })
    expect(resolveUploadEndpoint()).toBe("https://dt.example.com")
  })

  it("reads NEXT_PUBLIC_DEEPTRACER_ENDPOINT as fallback", () => {
    stubSourceMapEnv({ NEXT_PUBLIC_DEEPTRACER_ENDPOINT: "https://public.example.com" })
    expect(resolveUploadEndpoint()).toBe("https://public.example.com")
  })

  it("returns undefined when nothing is set", () => {
    expect(resolveUploadEndpoint()).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// resolveUploadApiKey
// ---------------------------------------------------------------------------

describe("resolveUploadApiKey", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("prefers dtConfig.apiKey", () => {
    stubSourceMapEnv({ DEEPTRACER_KEY: "dt_env" })
    expect(resolveUploadApiKey({ apiKey: "dt_config" })).toBe("dt_config")
  })

  it("reads DEEPTRACER_KEY", () => {
    stubSourceMapEnv({ DEEPTRACER_KEY: "dt_server" })
    expect(resolveUploadApiKey()).toBe("dt_server")
  })

  it("reads NEXT_PUBLIC_DEEPTRACER_KEY as fallback", () => {
    stubSourceMapEnv({ NEXT_PUBLIC_DEEPTRACER_KEY: "dt_public" })
    expect(resolveUploadApiKey()).toBe("dt_public")
  })

  it("returns undefined when nothing is set", () => {
    expect(resolveUploadApiKey()).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// withDeepTracer — backward compatibility (no dtConfig)
// ---------------------------------------------------------------------------

describe("withDeepTracer — backward compatibility", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("returns config with only serverExternalPackages when no dtConfig", () => {
    const result = withDeepTracer({})
    expect(result.serverExternalPackages).toBeDefined()
    expect(result.serverExternalPackages).toContain("@opentelemetry/api")
    expect(result.productionBrowserSourceMaps).toBeUndefined()
    expect(result.rewrites).toBeUndefined()
    expect(result.webpack).toBeUndefined()
    expect(result.compiler).toBeUndefined()
  })

  it("preserves existing serverExternalPackages", () => {
    const result = withDeepTracer({
      serverExternalPackages: ["my-package"],
    })
    expect(result.serverExternalPackages).toContain("my-package")
    expect(result.serverExternalPackages).toContain("@opentelemetry/api")
  })

  it("does not duplicate existing external packages", () => {
    const result = withDeepTracer({
      serverExternalPackages: ["@opentelemetry/api"],
    })
    const count = result.serverExternalPackages!.filter((p) => p === "@opentelemetry/api").length
    expect(count).toBe(1)
  })

  it("preserves all other config properties", () => {
    const result = withDeepTracer({
      reactStrictMode: true,
      poweredByHeader: false,
    })
    expect(result.reactStrictMode).toBe(true)
    expect(result.poweredByHeader).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// withDeepTracer — uploadSourceMaps: false
// ---------------------------------------------------------------------------

describe("withDeepTracer — uploadSourceMaps: false", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it("behaves the same as no dtConfig when uploadSourceMaps is false", () => {
    stubSourceMapEnv({ CI: "true" })
    const result = withDeepTracer({}, { uploadSourceMaps: false })
    expect(result.productionBrowserSourceMaps).toBeUndefined()
    expect(result.rewrites).toBeUndefined()
    expect(result.webpack).toBeUndefined()
    expect(result.compiler).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// withDeepTracer — uploadSourceMaps: true
// ---------------------------------------------------------------------------

describe("withDeepTracer — uploadSourceMaps: true", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    warnSpy.mockRestore()
  })

  it("sets productionBrowserSourceMaps to true", () => {
    const result = withDeepTracer(
      {},
      {
        uploadSourceMaps: true,
        release: "v1.0.0",
        endpoint: "https://dt.example.com",
        apiKey: "dt_test",
      },
    )
    expect(result.productionBrowserSourceMaps).toBe(true)
  })

  it("adds rewrites to block .map files", async () => {
    const result = withDeepTracer(
      {},
      {
        uploadSourceMaps: true,
        release: "v1.0.0",
        endpoint: "https://dt.example.com",
        apiKey: "dt_test",
      },
    )
    expect(result.rewrites).toBeDefined()
    const rewrites = await (result.rewrites as () => Promise<unknown>)()
    expect(rewrites).toEqual([{ source: "/:path*.map", destination: "/404" }])
  })

  it("merges rewrites with existing array rewrites", async () => {
    const existingRewrites = async () => [{ source: "/old/:path*", destination: "/new/:path*" }]
    const result = withDeepTracer(
      { rewrites: existingRewrites },
      {
        uploadSourceMaps: true,
        release: "v1.0.0",
        endpoint: "https://dt.example.com",
        apiKey: "dt_test",
      },
    )
    const rewrites = (await (result.rewrites as () => Promise<unknown>)()) as Array<{
      source: string
      destination: string
    }>
    expect(rewrites).toHaveLength(2)
    expect(rewrites[0]).toEqual({ source: "/:path*.map", destination: "/404" })
    expect(rewrites[1]).toEqual({ source: "/old/:path*", destination: "/new/:path*" })
  })

  it("merges rewrites with existing object rewrites", async () => {
    const existingRewrites = async () => ({
      beforeFiles: [{ source: "/before", destination: "/dest" }],
      afterFiles: [{ source: "/after", destination: "/dest" }],
    })
    const result = withDeepTracer(
      { rewrites: existingRewrites },
      {
        uploadSourceMaps: true,
        release: "v1.0.0",
        endpoint: "https://dt.example.com",
        apiKey: "dt_test",
      },
    )
    const rewrites = (await (result.rewrites as () => Promise<unknown>)()) as {
      beforeFiles: Array<{ source: string; destination: string }>
      afterFiles: Array<{ source: string; destination: string }>
    }
    expect(rewrites.beforeFiles).toHaveLength(2)
    expect(rewrites.beforeFiles[0]).toEqual({ source: "/:path*.map", destination: "/404" })
    expect(rewrites.beforeFiles[1]).toEqual({ source: "/before", destination: "/dest" })
    expect(rewrites.afterFiles).toEqual([{ source: "/after", destination: "/dest" }])
  })
})

// ---------------------------------------------------------------------------
// withDeepTracer — missing required values
// ---------------------------------------------------------------------------

describe("withDeepTracer — missing required values", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    warnSpy.mockRestore()
  })

  it("warns and skips when release is missing", () => {
    const result = withDeepTracer(
      {},
      {
        uploadSourceMaps: true,
        endpoint: "https://dt.example.com",
        apiKey: "dt_test",
      },
    )
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no release identifier"))
    expect(result.productionBrowserSourceMaps).toBeUndefined()
  })

  it("warns and skips when endpoint is missing", () => {
    const result = withDeepTracer(
      {},
      {
        uploadSourceMaps: true,
        release: "v1.0.0",
        apiKey: "dt_test",
      },
    )
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no endpoint found"))
    expect(result.productionBrowserSourceMaps).toBeUndefined()
  })

  it("warns and skips when apiKey is missing", () => {
    const result = withDeepTracer(
      {},
      {
        uploadSourceMaps: true,
        release: "v1.0.0",
        endpoint: "https://dt.example.com",
      },
    )
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("no API key found"))
    expect(result.productionBrowserSourceMaps).toBeUndefined()
  })

  it("still returns serverExternalPackages when upload is skipped", () => {
    const result = withDeepTracer(
      {},
      {
        uploadSourceMaps: true,
        // Missing all values — will skip upload
      },
    )
    expect(result.serverExternalPackages).toBeDefined()
    expect(result.serverExternalPackages).toContain("@opentelemetry/api")
  })
})

// ---------------------------------------------------------------------------
// withDeepTracer — CI auto-detection
// ---------------------------------------------------------------------------

describe("withDeepTracer — CI auto-detection", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    warnSpy.mockRestore()
  })

  it("auto-enables source maps in CI with all values present", () => {
    stubSourceMapEnv({
      CI: "true",
      DEEPTRACER_RELEASE: "ci-build-123",
      DEEPTRACER_ENDPOINT: "https://dt.example.com",
      DEEPTRACER_KEY: "dt_ci_key",
    })

    const result = withDeepTracer({})
    expect(result.productionBrowserSourceMaps).toBe(true)
    expect(result.rewrites).toBeDefined()
    expect(result.compiler?.runAfterProductionCompile).toBeDefined()
  })

  it("auto-enables on Vercel with VERCEL_GIT_COMMIT_SHA as release", () => {
    stubSourceMapEnv({
      VERCEL: "1",
      VERCEL_GIT_COMMIT_SHA: "abc123def456",
      DEEPTRACER_ENDPOINT: "https://dt.example.com",
      DEEPTRACER_KEY: "dt_vercel_key",
    })

    const result = withDeepTracer({})
    expect(result.productionBrowserSourceMaps).toBe(true)
  })

  it("does not auto-enable when not in CI and no explicit config", () => {
    const result = withDeepTracer({})
    expect(result.productionBrowserSourceMaps).toBeUndefined()
    expect(result.rewrites).toBeUndefined()
    expect(result.compiler).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// withDeepTracer — compiler hook (runAfterProductionCompile)
// ---------------------------------------------------------------------------

describe("withDeepTracer — compiler hook", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>

  const dtConfig = {
    uploadSourceMaps: true as const,
    release: "v1.0.0",
    endpoint: "https://dt.example.com",
    apiKey: "dt_test",
  }

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    warnSpy.mockRestore()
  })

  it("sets result.compiler.runAfterProductionCompile to a function", () => {
    const result = withDeepTracer({}, dtConfig)
    expect(result.compiler).toBeDefined()
    expect(typeof result.compiler?.runAfterProductionCompile).toBe("function")
  })

  it("does not set result.webpack", () => {
    const result = withDeepTracer({}, dtConfig)
    expect(result.webpack).toBeUndefined()
  })

  it("preserves existing compiler options alongside our hook", () => {
    const result = withDeepTracer(
      { compiler: { removeConsole: true } },
      dtConfig,
    )
    expect(result.compiler?.removeConsole).toBe(true)
    expect(typeof result.compiler?.runAfterProductionCompile).toBe("function")
  })

  it("merges with existing runAfterProductionCompile — user hook runs first", async () => {
    const callOrder: string[] = []
    const userHook = async () => {
      callOrder.push("user")
    }

    fsMocks.readdir.mockResolvedValue([])

    const result = withDeepTracer(
      { compiler: { runAfterProductionCompile: userHook } },
      dtConfig,
    )

    await result.compiler?.runAfterProductionCompile?.({
      distDir: "/fake/.next",
      projectDir: "/fake",
    })

    expect(callOrder[0]).toBe("user")
  })
})

// ---------------------------------------------------------------------------
// withDeepTracer — runAfterProductionCompile callback behavior
// ---------------------------------------------------------------------------

describe("withDeepTracer — runAfterProductionCompile callback", () => {
  let warnSpy: ReturnType<typeof vi.spyOn>
  let logSpy: ReturnType<typeof vi.spyOn>
  let fetchSpy: ReturnType<typeof vi.spyOn>

  const dtConfig = {
    uploadSourceMaps: true as const,
    release: "v1.0.0",
    endpoint: "https://dt.example.com",
    apiKey: "dt_test",
  }

  const metadata = { distDir: "/fake/.next", projectDir: "/fake" }

  beforeEach(() => {
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {})
    logSpy = vi.spyOn(console, "log").mockImplementation(() => {})
    fsMocks.readdir.mockReset()
    fsMocks.readFile.mockReset()
    fsMocks.unlink.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    if (fetchSpy) fetchSpy.mockRestore()
    warnSpy.mockRestore()
    logSpy.mockRestore()
  })

  it("calls fetch with correct URL and Authorization header when .map files exist", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 }),
    )
    fsMocks.readdir.mockResolvedValue(["static/chunks/app.js.map"])
    fsMocks.readFile.mockResolvedValue(Buffer.from('{"version":3}'))
    fsMocks.unlink.mockResolvedValue(undefined)

    const result = withDeepTracer({}, dtConfig)
    await result.compiler?.runAfterProductionCompile?.(metadata)

    expect(fetchSpy).toHaveBeenCalledOnce()
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit]
    expect(url).toBe("https://dt.example.com/ingest/sourcemaps")
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer dt_test")
  })

  it("logs 'No source map files found' when distDir has no .map files", async () => {
    fsMocks.readdir.mockResolvedValue(["app.js", "app.css"])

    const result = withDeepTracer({}, dtConfig)
    await result.compiler?.runAfterProductionCompile?.(metadata)

    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("No source map files found"),
    )
  })

  it("does not throw when distDir does not exist (ENOENT)", async () => {
    const enoent = Object.assign(new Error("ENOENT"), { code: "ENOENT" })
    fsMocks.readdir.mockRejectedValue(enoent)

    const result = withDeepTracer({}, dtConfig)
    await expect(
      result.compiler?.runAfterProductionCompile?.(metadata),
    ).resolves.toBeUndefined()
  })

  it("warns on HTTP error but does not throw", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("server error", { status: 500 }),
    )
    fsMocks.readdir.mockResolvedValue(["app.js.map"])
    fsMocks.readFile.mockResolvedValue(Buffer.from("{}"))

    const result = withDeepTracer({}, dtConfig)
    await expect(
      result.compiler?.runAfterProductionCompile?.(metadata),
    ).resolves.toBeUndefined()

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("Source map upload failed"),
    )
  })

  it("deletes .map files from disk after successful upload when enabled", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 }),
    )
    fsMocks.readdir.mockResolvedValue(["a.js.map", "b.js.map"])
    fsMocks.readFile.mockResolvedValue(Buffer.from("{}"))
    fsMocks.unlink.mockResolvedValue(undefined)

    const result = withDeepTracer({}, { ...dtConfig, deleteSourceMapsAfterUpload: true })
    await result.compiler?.runAfterProductionCompile?.(metadata)

    expect(fsMocks.unlink).toHaveBeenCalledTimes(2)
    expect(logSpy).toHaveBeenCalledWith(
      expect.stringContaining("Deleted 2 source map(s)"),
    )
  })

  it("does NOT delete files when upload fails", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("error", { status: 500 }),
    )
    fsMocks.readdir.mockResolvedValue(["a.js.map"])
    fsMocks.readFile.mockResolvedValue(Buffer.from("{}"))
    fsMocks.unlink.mockResolvedValue(undefined)

    const result = withDeepTracer({}, { ...dtConfig, deleteSourceMapsAfterUpload: true })
    await result.compiler?.runAfterProductionCompile?.(metadata)

    expect(fsMocks.unlink).not.toHaveBeenCalled()
  })

  it("does NOT delete files when deleteSourceMapsAfterUpload is false (default)", async () => {
    fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("ok", { status: 200 }),
    )
    fsMocks.readdir.mockResolvedValue(["a.js.map"])
    fsMocks.readFile.mockResolvedValue(Buffer.from("{}"))
    fsMocks.unlink.mockResolvedValue(undefined)

    const result = withDeepTracer({}, dtConfig)
    await result.compiler?.runAfterProductionCompile?.(metadata)

    expect(fsMocks.unlink).not.toHaveBeenCalled()
  })
})
