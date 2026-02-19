import { describe, it, expect } from "vitest"
import { parseTraceparent } from "../logger"

describe("parseTraceparent", () => {
  it("parses valid traceparent header", () => {
    const result = parseTraceparent("00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01")
    expect(result).toEqual({
      traceId: "0af7651916cd43dd8448eb211c80319c",
      parentId: "b7ad6b7169203331",
      flags: "01",
    })
  })

  it("parses traceparent with flags 00 (not sampled)", () => {
    const result = parseTraceparent("00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-00")
    expect(result).not.toBeNull()
    expect(result!.flags).toBe("00")
  })

  it("rejects wrong version", () => {
    expect(parseTraceparent("01-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01")).toBeNull()
  })

  it("rejects too few parts", () => {
    expect(parseTraceparent("00-abcd-1234")).toBeNull()
  })

  it("rejects too many parts", () => {
    expect(parseTraceparent("00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01-extra")).toBeNull()
  })

  it("rejects trace-id with wrong length", () => {
    expect(parseTraceparent("00-0af7651916cd43dd8448eb211c8031-b7ad6b7169203331-01")).toBeNull()
    expect(parseTraceparent("00-0af7651916cd43dd8448eb211c80319c00-b7ad6b7169203331-01")).toBeNull()
  })

  it("rejects parent-id with wrong length", () => {
    expect(parseTraceparent("00-0af7651916cd43dd8448eb211c80319c-b7ad6b71692033-01")).toBeNull()
  })

  it("rejects uppercase hex", () => {
    expect(parseTraceparent("00-0AF7651916CD43DD8448EB211C80319C-b7ad6b7169203331-01")).toBeNull()
  })

  it("rejects all-zero trace-id", () => {
    expect(parseTraceparent("00-00000000000000000000000000000000-b7ad6b7169203331-01")).toBeNull()
  })

  it("rejects all-zero parent-id", () => {
    expect(parseTraceparent("00-0af7651916cd43dd8448eb211c80319c-0000000000000000-01")).toBeNull()
  })

  it("handles leading/trailing whitespace", () => {
    const result = parseTraceparent("  00-0af7651916cd43dd8448eb211c80319c-b7ad6b7169203331-01  ")
    expect(result).not.toBeNull()
  })

  it("returns null for empty string", () => {
    expect(parseTraceparent("")).toBeNull()
  })

  it("rejects non-hex characters in trace-id", () => {
    expect(parseTraceparent("00-0af7651916cd43dd8448eb211c80319g-b7ad6b7169203331-01")).toBeNull()
  })
})
