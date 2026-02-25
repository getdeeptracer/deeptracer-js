import { describe, it, expect, vi, beforeEach, afterEach } from "vitest"
import { Batcher } from "../batcher"
import type { LogEntry } from "../types"

function makeEntry(message: string): LogEntry {
  return {
    timestamp: new Date().toISOString(),
    level: "info",
    message,
  }
}

describe("Batcher", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("calls onFlush when batch size is reached", () => {
    const onFlush = vi.fn()
    const batcher = new Batcher({ batchSize: 3 }, onFlush)

    batcher.add(makeEntry("1"))
    batcher.add(makeEntry("2"))
    expect(onFlush).not.toHaveBeenCalled()

    batcher.add(makeEntry("3"))
    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush.mock.calls[0][0]).toHaveLength(3)

    batcher.destroy()
  })

  it("does not flush before batch size is reached", () => {
    const onFlush = vi.fn()
    const batcher = new Batcher({ batchSize: 10 }, onFlush)

    for (let i = 0; i < 9; i++) {
      batcher.add(makeEntry(`${i}`))
    }
    expect(onFlush).not.toHaveBeenCalled()

    batcher.destroy()
  })

  it("flushes on interval timer", () => {
    const onFlush = vi.fn()
    const batcher = new Batcher({ batchSize: 100, flushIntervalMs: 2000 }, onFlush)

    batcher.add(makeEntry("1"))
    expect(onFlush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(2000)
    expect(onFlush).toHaveBeenCalledOnce()

    batcher.destroy()
  })

  it("does not flush on interval if buffer is empty", () => {
    const onFlush = vi.fn()
    const batcher = new Batcher({ flushIntervalMs: 1000 }, onFlush)

    vi.advanceTimersByTime(5000)
    expect(onFlush).not.toHaveBeenCalled()

    batcher.destroy()
  })

  it("flush() manually triggers flush", () => {
    const onFlush = vi.fn()
    const batcher = new Batcher({ batchSize: 100 }, onFlush)

    batcher.add(makeEntry("1"))
    batcher.flush()
    expect(onFlush).toHaveBeenCalledOnce()

    batcher.destroy()
  })

  it("flush() is no-op when buffer is empty", () => {
    const onFlush = vi.fn()
    const batcher = new Batcher({}, onFlush)

    batcher.flush()
    expect(onFlush).not.toHaveBeenCalled()

    batcher.destroy()
  })

  it("destroy() flushes remaining items", async () => {
    const onFlush = vi.fn()
    const batcher = new Batcher({ batchSize: 100 }, onFlush)

    batcher.add(makeEntry("1"))
    batcher.add(makeEntry("2"))
    await batcher.destroy()

    expect(onFlush).toHaveBeenCalledOnce()
    expect(onFlush.mock.calls[0][0]).toHaveLength(2)
  })

  it("destroy() clears the interval timer", async () => {
    const onFlush = vi.fn()
    const batcher = new Batcher({ batchSize: 100, flushIntervalMs: 1000 }, onFlush)

    batcher.add(makeEntry("1"))
    await batcher.destroy()
    onFlush.mockClear()

    // Advance timers — interval should be cleared, no more flushes
    vi.advanceTimersByTime(10000)
    expect(onFlush).not.toHaveBeenCalled()
  })

  it("uses default batchSize of 50", () => {
    const onFlush = vi.fn()
    const batcher = new Batcher({}, onFlush)

    for (let i = 0; i < 49; i++) {
      batcher.add(makeEntry(`${i}`))
    }
    expect(onFlush).not.toHaveBeenCalled()

    batcher.add(makeEntry("50"))
    expect(onFlush).toHaveBeenCalledOnce()

    batcher.destroy()
  })

  it("defaults to 200ms interval in serverless environments", () => {
    vi.stubEnv("VERCEL", "1")
    const onFlush = vi.fn()
    const batcher = new Batcher({}, onFlush)

    batcher.add(makeEntry("serverless log"))
    expect(onFlush).not.toHaveBeenCalled()

    vi.advanceTimersByTime(200)
    expect(onFlush).toHaveBeenCalledOnce()

    batcher.destroy()
    vi.unstubAllEnvs()
  })

  it("onFlush receives entries and buffer is cleared", () => {
    const onFlush = vi.fn()
    const batcher = new Batcher({ batchSize: 2 }, onFlush)

    batcher.add(makeEntry("a"))
    batcher.add(makeEntry("b"))
    expect(onFlush).toHaveBeenCalledOnce()

    // Add more — should not include previous batch
    batcher.add(makeEntry("c"))
    batcher.add(makeEntry("d"))
    expect(onFlush).toHaveBeenCalledTimes(2)
    expect(onFlush.mock.calls[1][0]).toHaveLength(2)
    expect(onFlush.mock.calls[1][0][0].message).toBe("c")

    batcher.destroy()
  })
})
