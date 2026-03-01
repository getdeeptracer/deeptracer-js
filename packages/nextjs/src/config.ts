import type { NextConfig } from "next"

/**
 * OpenTelemetry packages used by DeepTracer's auto-tracing feature.
 * These must be excluded from Next.js bundling because they use Node.js
 * built-in modules (like `diagnostics_channel`) that don't exist in
 * browser or edge environments.
 */
const EXTERNAL_PACKAGES = [
  "@opentelemetry/api",
  "@opentelemetry/core",
  "@opentelemetry/sdk-trace-base",
  "@opentelemetry/sdk-trace-node",
  "@opentelemetry/instrumentation-undici",
]

/**
 * Configuration for automatic source map upload during `next build`.
 *
 * When enabled, DeepTracer will:
 * 1. Enable `productionBrowserSourceMaps` so the bundler emits `.map` files
 * 2. Add a rewrite rule to block public access to `.map` files (returns 404)
 * 3. Upload all `.map` files to DeepTracer after the production build completes
 *
 * Source maps are matched to errors using the `release` identifier.
 */
export interface DeepTracerSourceMapConfig {
  /**
   * Enable source map upload during build.
   *
   * Default: auto-detect CI environments. Enabled when any of these are set:
   * - `CI=true`
   * - `VERCEL=1`
   * - `DEEPTRACER_UPLOAD_SOURCEMAPS=true`
   */
  uploadSourceMaps?: boolean
  /**
   * Delete `.map` files from the build output after successful upload.
   *
   * This prevents source maps from being deployed to your CDN/hosting,
   * even though the rewrite rule already blocks public access.
   * Defense-in-depth — the files are deleted from disk after upload.
   *
   * Default: `false`
   */
  deleteSourceMapsAfterUpload?: boolean
  /**
   * Release identifier to tag source maps with.
   *
   * Default: auto-detect from environment variables in this order:
   * 1. `DEEPTRACER_RELEASE`
   * 2. `VERCEL_GIT_COMMIT_SHA`
   * 3. `GIT_COMMIT_SHA`
   */
  release?: string
  /**
   * DeepTracer ingestion endpoint URL.
   *
   * Default: `DEEPTRACER_ENDPOINT` or `NEXT_PUBLIC_DEEPTRACER_ENDPOINT` env var
   */
  endpoint?: string
  /**
   * DeepTracer API key.
   *
   * Default: `DEEPTRACER_KEY` or `NEXT_PUBLIC_DEEPTRACER_KEY` env var
   */
  apiKey?: string
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/** Detect CI environment from common env vars */
function shouldAutoEnable(): boolean {
  return (
    process.env.CI === "true" ||
    process.env.VERCEL === "1" ||
    process.env.DEEPTRACER_UPLOAD_SOURCEMAPS === "true"
  )
}

/** Resolve whether source map upload is enabled */
export function isUploadEnabled(dtConfig?: DeepTracerSourceMapConfig): boolean {
  if (dtConfig?.uploadSourceMaps === true) return true
  if (dtConfig?.uploadSourceMaps === false) return false
  return shouldAutoEnable()
}

/** Resolve the release identifier from config or env vars */
export function resolveUploadRelease(dtConfig?: DeepTracerSourceMapConfig): string | undefined {
  return (
    dtConfig?.release ??
    process.env.DEEPTRACER_RELEASE ??
    process.env.VERCEL_GIT_COMMIT_SHA ??
    process.env.GIT_COMMIT_SHA
  )
}

/** Resolve the ingestion endpoint from config or env vars */
export function resolveUploadEndpoint(dtConfig?: DeepTracerSourceMapConfig): string | undefined {
  return (
    dtConfig?.endpoint ??
    process.env.DEEPTRACER_ENDPOINT ??
    process.env.NEXT_PUBLIC_DEEPTRACER_ENDPOINT
  )
}

/** Resolve the API key from config or env vars */
export function resolveUploadApiKey(dtConfig?: DeepTracerSourceMapConfig): string | undefined {
  return dtConfig?.apiKey ?? process.env.DEEPTRACER_KEY ?? process.env.NEXT_PUBLIC_DEEPTRACER_KEY
}

// ---------------------------------------------------------------------------
// Filesystem scan — finds all .map files in distDir after the build
// ---------------------------------------------------------------------------

/**
 * Recursively find all *.map files under `dir`.
 * Uses Node.js 20+ `readdir({ recursive: true })`.
 * Returns absolute paths, sorted for deterministic ordering.
 */
async function findMapFiles(dir: string): Promise<string[]> {
  const { readdir } = await import("node:fs/promises")

  let entries: string[]
  try {
    entries = (await readdir(dir, { recursive: true })) as string[]
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") {
      return []
    }
    throw err
  }

  const maps: string[] = []
  for (const entry of entries) {
    if (typeof entry === "string" && entry.endsWith(".map")) {
      maps.push(`${dir}/${entry}`)
    }
  }
  return maps.sort()
}

// ---------------------------------------------------------------------------
// Upload logic — uploads .map files to DeepTracer in chunks
// ---------------------------------------------------------------------------

const CHUNK_SIZE = 20

/**
 * Find all .map files in distDir and upload them to DeepTracer.
 * If deleteAfterUpload is true, removes files from disk after a successful upload.
 * All errors are caught and logged — the build never fails due to upload issues.
 */
async function uploadSourceMaps(
  distDir: string,
  release: string,
  endpoint: string,
  apiKey: string,
  deleteAfterUpload: boolean,
): Promise<void> {
  const { readFile, unlink } = await import("node:fs/promises")
  const path = await import("node:path")

  const files = await findMapFiles(distDir)

  if (files.length === 0) {
    console.log("[@deeptracer/nextjs] No source map files found to upload.")
    return
  }

  const url = `${endpoint.replace(/\/$/, "")}/ingest/sourcemaps`
  let uploadedCount = 0

  for (let i = 0; i < files.length; i += CHUNK_SIZE) {
    const chunk = files.slice(i, i + CHUNK_SIZE)
    const formData = new FormData()
    formData.append("release", release)

    for (const filePath of chunk) {
      const content = await readFile(filePath)
      const name = path.relative(distDir, filePath)
      const blob = new Blob([content], { type: "application/json" })
      formData.append("files", blob, name)
    }

    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
      signal: AbortSignal.timeout(30_000),
    })

    if (response.ok) {
      uploadedCount += chunk.length

      if (deleteAfterUpload) {
        for (const filePath of chunk) {
          await unlink(filePath).catch((err: unknown) => {
            console.warn(
              `[@deeptracer/nextjs] Could not delete ${filePath}: ${err instanceof Error ? err.message : err}`,
            )
          })
        }
      }
    } else {
      const text = await response.text().catch(() => "")
      console.warn(
        `[@deeptracer/nextjs] Source map upload failed (HTTP ${response.status}): ${text}`,
      )
    }
  }

  if (uploadedCount > 0) {
    console.log(
      `[@deeptracer/nextjs] Uploaded ${uploadedCount} source map(s) for release "${release}".`,
    )
    if (deleteAfterUpload) {
      console.log(
        `[@deeptracer/nextjs] Deleted ${uploadedCount} source map(s) from build output.`,
      )
    }
  }
}

// ---------------------------------------------------------------------------
// Rewrites helper — merges DeepTracer's .map-blocking rule with existing rewrites
// ---------------------------------------------------------------------------

type RewriteRule = { source: string; destination: string }
type RewriteArray = RewriteRule[]
type RewriteObject = {
  beforeFiles?: RewriteRule[]
  afterFiles?: RewriteRule[]
  fallback?: RewriteRule[]
}

const MAP_BLOCK_RULE: RewriteRule = { source: "/:path*.map", destination: "/404" }

/**
 * Merges our .map-blocking rewrite with any existing user rewrites.
 * Handles both array and object return formats.
 */
function mergeRewrites(
  existingRewrites: NextConfig["rewrites"],
): () => Promise<RewriteArray | RewriteObject> {
  return async () => {
    if (!existingRewrites) {
      return [MAP_BLOCK_RULE]
    }

    const existing = typeof existingRewrites === "function" ? await existingRewrites() : []

    if (Array.isArray(existing)) {
      return [MAP_BLOCK_RULE, ...existing]
    }

    // Object format — add to beforeFiles so it takes priority
    return {
      ...existing,
      beforeFiles: [MAP_BLOCK_RULE, ...(existing.beforeFiles ?? [])],
    }
  }
}

// ---------------------------------------------------------------------------
// Compiler hook — uploads .map files after production build completes
// ---------------------------------------------------------------------------

type CompileMetadata = { distDir: string; projectDir: string }
type RunAfterFn = (metadata: CompileMetadata) => Promise<void>

/**
 * Merges DeepTracer's post-build source map upload with any existing
 * compiler.runAfterProductionCompile callback the user may have set.
 * Works with both webpack and Turbopack — runs after the build regardless
 * of which bundler was used.
 */
function mergeCompiler(
  existingCompiler: NextConfig["compiler"],
  release: string,
  endpoint: string,
  apiKey: string,
  deleteAfterUpload: boolean,
): NonNullable<NextConfig["compiler"]> {
  const existingHook = existingCompiler?.runAfterProductionCompile as RunAfterFn | undefined

  const ourHook: RunAfterFn = async ({ distDir }) => {
    try {
      await uploadSourceMaps(distDir, release, endpoint, apiKey, deleteAfterUpload)
    } catch (err) {
      console.warn(
        "[@deeptracer/nextjs] Source map upload failed:",
        err instanceof Error ? err.message : err,
      )
    }
  }

  const mergedHook: RunAfterFn = existingHook
    ? async (metadata) => {
        await existingHook(metadata)
        await ourHook(metadata)
      }
    : ourHook

  return {
    ...existingCompiler,
    runAfterProductionCompile: mergedHook,
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Wraps your Next.js config to:
 * 1. Prevent OpenTelemetry packages from being bundled into client-side or edge chunks
 * 2. Optionally upload source maps to DeepTracer after `next build` (works with both webpack and Turbopack)
 *
 * Source map upload is auto-enabled in CI environments (Vercel, GitHub Actions, etc.)
 * or can be explicitly controlled via the `dtConfig` parameter.
 *
 * @param config - Your existing Next.js config (default: `{}`)
 * @param dtConfig - Optional source map upload configuration
 * @returns The same config with DeepTracer's required modifications merged in
 *
 * @example
 * Basic usage — source maps auto-upload in CI:
 * ```ts
 * // next.config.ts
 * import { withDeepTracer } from "@deeptracer/nextjs/config"
 *
 * export default withDeepTracer({
 *   // your existing Next.js config
 * })
 * ```
 *
 * @example
 * Explicit source map upload:
 * ```ts
 * import { withDeepTracer } from "@deeptracer/nextjs/config"
 *
 * export default withDeepTracer(
 *   { reactStrictMode: true },
 *   {
 *     uploadSourceMaps: true,
 *     release: "v1.2.3",
 *   },
 * )
 * ```
 *
 * @example
 * Composing with other wrappers:
 * ```ts
 * import { withDeepTracer } from "@deeptracer/nextjs/config"
 * import { withSentryConfig } from "@sentry/nextjs"
 *
 * export default withDeepTracer(withSentryConfig({ reactStrictMode: true }))
 * ```
 */
export function withDeepTracer(
  config: NextConfig = {},
  dtConfig?: DeepTracerSourceMapConfig,
): NextConfig {
  const existing = config.serverExternalPackages ?? []

  const result: NextConfig = {
    ...config,
    serverExternalPackages: [
      ...existing,
      ...EXTERNAL_PACKAGES.filter((p) => !existing.includes(p)),
    ],
  }

  // If source map upload is not enabled, return early with just serverExternalPackages
  if (!isUploadEnabled(dtConfig)) {
    return result
  }

  // Resolve required values for source map upload
  const release = resolveUploadRelease(dtConfig)
  const endpoint = resolveUploadEndpoint(dtConfig)
  const apiKey = resolveUploadApiKey(dtConfig)

  if (!release) {
    console.warn(
      "[@deeptracer/nextjs] Source map upload enabled but no release identifier found. " +
        "Set DEEPTRACER_RELEASE env var, pass `release` to withDeepTracer(), or deploy via " +
        "a platform that sets VERCEL_GIT_COMMIT_SHA / GIT_COMMIT_SHA. Skipping upload.",
    )
    return result
  }

  if (!endpoint) {
    console.warn(
      "[@deeptracer/nextjs] Source map upload enabled but no endpoint found. " +
        "Set DEEPTRACER_ENDPOINT or NEXT_PUBLIC_DEEPTRACER_ENDPOINT env var, " +
        "or pass `endpoint` to withDeepTracer(). Skipping upload.",
    )
    return result
  }

  if (!apiKey) {
    console.warn(
      "[@deeptracer/nextjs] Source map upload enabled but no API key found. " +
        "Set DEEPTRACER_KEY or NEXT_PUBLIC_DEEPTRACER_KEY env var, " +
        "or pass `apiKey` to withDeepTracer(). Skipping upload.",
    )
    return result
  }

  // Enable source maps in the production browser build
  result.productionBrowserSourceMaps = true

  // Block public access to .map files via rewrites
  result.rewrites = mergeRewrites(config.rewrites)

  // Schedule post-build source map upload via runAfterProductionCompile
  const deleteAfterUpload = dtConfig?.deleteSourceMapsAfterUpload ?? false
  result.compiler = mergeCompiler(config.compiler, release, endpoint, apiKey, deleteAfterUpload)

  return result
}
