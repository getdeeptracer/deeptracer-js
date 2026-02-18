import type { LogEntry } from "./types"

export class Batcher {
  private buffer: LogEntry[] = []
  private timer: ReturnType<typeof setInterval> | null = null
  private batchSize: number
  private flushIntervalMs: number

  constructor(
    config: { batchSize?: number; flushIntervalMs?: number },
    private onFlush: (entries: LogEntry[]) => void,
  ) {
    this.batchSize = config.batchSize ?? 50
    this.flushIntervalMs = config.flushIntervalMs ?? 5000
    this.startTimer()
  }

  add(entry: LogEntry) {
    this.buffer.push(entry)
    if (this.buffer.length >= this.batchSize) {
      this.flush()
    }
  }

  flush() {
    if (this.buffer.length === 0) return
    const entries = [...this.buffer]
    this.buffer = []
    this.onFlush(entries)
  }

  private startTimer() {
    this.timer = setInterval(() => this.flush(), this.flushIntervalMs)
  }

  async destroy(): Promise<void> {
    if (this.timer) clearInterval(this.timer)
    this.timer = null
    this.flush()
  }
}
