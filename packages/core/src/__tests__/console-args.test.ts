import { describe, it, expect } from "vitest"
import { parseConsoleArgs } from "../internal"

describe("parseConsoleArgs", () => {
  it("returns empty message for empty args", () => {
    expect(parseConsoleArgs([])).toEqual({ message: "" })
  })

  it("single string becomes message", () => {
    expect(parseConsoleArgs(["hello"])).toEqual({ message: "hello" })
  })

  it("string + object: string is message, object is metadata", () => {
    const result = parseConsoleArgs(["hello", { userId: 123 }])
    expect(result.message).toBe("hello")
    expect(result.metadata).toEqual({ userId: 123 })
  })

  it("string + multiple objects: all merged into metadata", () => {
    const result = parseConsoleArgs(["msg", { a: 1 }, { b: 2 }])
    expect(result.message).toBe("msg")
    expect(result.metadata).toEqual({ a: 1, b: 2 })
  })

  it("string + primitive args: primitives appended to message", () => {
    const result = parseConsoleArgs(["count:", 42, true])
    expect(result.message).toBe("count: 42 true")
    expect(result.metadata).toBeUndefined()
  })

  it("printf pattern joins all as string, no metadata", () => {
    const result = parseConsoleArgs(["User %s logged in at %d", "alice", 1234])
    expect(result.message).toBe("User %s logged in at %d alice 1234")
    expect(result.metadata).toBeUndefined()
  })

  it("Error as first arg: message is error.message, metadata has serialized error", () => {
    const err = new Error("boom")
    const result = parseConsoleArgs([err])
    expect(result.message).toBe("boom")
    expect(result.metadata?.error).toEqual({
      name: "Error",
      message: "boom",
      stack: err.stack,
    })
  })

  it("Error as second arg: string is message, error serialized in metadata", () => {
    const err = new Error("fail")
    const result = parseConsoleArgs(["request failed", err])
    expect(result.message).toBe("request failed")
    expect(result.metadata?.error).toEqual({
      name: "Error",
      message: "fail",
      stack: err.stack,
    })
  })

  it("multiple Errors: keyed as error, error_1", () => {
    const e1 = new Error("first")
    const e2 = new Error("second")
    const result = parseConsoleArgs(["errors", e1, e2])
    expect(result.metadata?.error).toBeDefined()
    expect(result.metadata?.error_1).toBeDefined()
  })

  it("object as first arg: stringified as message", () => {
    const result = parseConsoleArgs([{ key: "value" }])
    expect(result.message).toBe('{"key":"value"}')
  })

  it("handles circular references without throwing", () => {
    const obj: any = { a: 1 }
    obj.self = obj
    const result = parseConsoleArgs([obj])
    expect(result.message).toContain("Circular")
  })

  it("handles null first arg", () => {
    const result = parseConsoleArgs([null])
    expect(result.message).toBe("null")
  })

  it("handles undefined args in the middle", () => {
    const result = parseConsoleArgs(["msg", undefined, { a: 1 }])
    expect(result.message).toBe("msg")
    expect(result.metadata).toEqual({ a: 1 })
  })
})
