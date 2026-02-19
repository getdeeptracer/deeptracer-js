import { describe, it, expect } from "vitest"
import { createLoggerState, cloneState, addBreadcrumb } from "../state"

describe("createLoggerState", () => {
  it("creates state with null user and empty collections", () => {
    const state = createLoggerState(10)
    expect(state.user).toBeNull()
    expect(state.tags).toEqual({})
    expect(state.contexts).toEqual({})
    expect(state.breadcrumbs).toEqual([])
    expect(state.maxBreadcrumbs).toBe(10)
  })
})

describe("cloneState", () => {
  it("clone has same values as original", () => {
    const state = createLoggerState(5)
    state.user = { id: "u1", email: "a@b.com" }
    state.tags = { release: "1.0" }
    state.contexts = { server: { host: "web-1" } }
    addBreadcrumb(state, { type: "log", message: "hello", timestamp: "2024-01-01T00:00:00Z" })

    const clone = cloneState(state)
    expect(clone.user).toEqual({ id: "u1", email: "a@b.com" })
    expect(clone.tags).toEqual({ release: "1.0" })
    expect(clone.contexts).toEqual({ server: { host: "web-1" } })
    expect(clone.breadcrumbs).toHaveLength(1)
    expect(clone.maxBreadcrumbs).toBe(5)
  })

  it("mutating clone.user does not affect parent", () => {
    const state = createLoggerState(5)
    state.user = { id: "u1" }
    const clone = cloneState(state)
    clone.user!.id = "u2"
    expect(state.user!.id).toBe("u1")
  })

  it("mutating clone.tags does not affect parent", () => {
    const state = createLoggerState(5)
    state.tags = { a: "1" }
    const clone = cloneState(state)
    clone.tags.b = "2"
    expect(state.tags).toEqual({ a: "1" })
  })

  it("mutating clone.contexts does not affect parent", () => {
    const state = createLoggerState(5)
    state.contexts = { server: { host: "web-1" } }
    const clone = cloneState(state)
    clone.contexts.server.host = "web-2"
    expect(state.contexts.server.host).toBe("web-1")
  })

  it("mutating clone.breadcrumbs does not affect parent", () => {
    const state = createLoggerState(5)
    addBreadcrumb(state, { type: "log", message: "a", timestamp: "t1" })
    const clone = cloneState(state)
    addBreadcrumb(clone, { type: "log", message: "b", timestamp: "t2" })
    expect(state.breadcrumbs).toHaveLength(1)
    expect(clone.breadcrumbs).toHaveLength(2)
  })

  it("cloning state with null user produces null", () => {
    const state = createLoggerState(5)
    const clone = cloneState(state)
    expect(clone.user).toBeNull()
  })
})

describe("addBreadcrumb", () => {
  it("adds breadcrumb to state", () => {
    const state = createLoggerState(5)
    addBreadcrumb(state, { type: "log", message: "hi", timestamp: "t1" })
    expect(state.breadcrumbs).toHaveLength(1)
    expect(state.breadcrumbs[0].message).toBe("hi")
  })

  it("breadcrumbs accumulate in order", () => {
    const state = createLoggerState(5)
    addBreadcrumb(state, { type: "a", message: "1", timestamp: "t1" })
    addBreadcrumb(state, { type: "b", message: "2", timestamp: "t2" })
    addBreadcrumb(state, { type: "c", message: "3", timestamp: "t3" })
    expect(state.breadcrumbs.map((b) => b.message)).toEqual(["1", "2", "3"])
  })

  it("evicts oldest when at capacity", () => {
    const state = createLoggerState(2)
    addBreadcrumb(state, { type: "a", message: "1", timestamp: "t1" })
    addBreadcrumb(state, { type: "b", message: "2", timestamp: "t2" })
    addBreadcrumb(state, { type: "c", message: "3", timestamp: "t3" })
    expect(state.breadcrumbs).toHaveLength(2)
    expect(state.breadcrumbs.map((b) => b.message)).toEqual(["2", "3"])
  })
})
