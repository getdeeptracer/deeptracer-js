import { vi } from "vitest"
import type { LoggerConfig } from "../types"

/** Minimal valid config for tests. Endpoint is fake — transport tests mock fetch. */
export function testConfig(overrides?: Partial<LoggerConfig>): LoggerConfig {
  return {
    secretKey: "dt_secret_test_key",
    endpoint: "https://test.deeptracer.dev",
    service: "test-service",
    environment: "test",
    ...overrides,
  }
}

/**
 * Mock globalThis.fetch to capture requests.
 * Returns the mock function and an array of captured { url, body } pairs.
 */
export function mockFetch(status = 200) {
  const calls: { url: string; body: any }[] = []
  const mock = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    const body = init?.body ? JSON.parse(init.body as string) : undefined
    calls.push({ url: url.toString(), body })
    return new Response(null, { status })
  })
  vi.stubGlobal("fetch", mock)
  return { mock, calls }
}
