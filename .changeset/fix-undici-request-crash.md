---
"@deeptracer/nextjs": patch
---

Fix TypeError crash when route handlers clone a Request object

`UndiciInstrumentation` from `@opentelemetry/instrumentation-undici` patched the global `Request` constructor, breaking the standard `new Request(existingRequest, options)` copy-constructor pattern used by Better Auth, Remix adapters, and any middleware that clones requests with modified headers. The crash:

```
TypeError: Cannot read private member #state from an object whose class did not declare it
    at new Request (node:internal/deps/undici/undici:10984:27)
```

The fix replaces `UndiciInstrumentation` with a `globalThis.fetch` wrapper — the same approach used by `@vercel/otel` and Sentry v8 after their own undici crash.

The wrapper:
- Creates a `SpanKind.CLIENT` child span for each outgoing fetch call
- Injects `traceparent` from the child span's context (correct: downstream sees the immediate caller, not the route handler)
- Records `http.method`, `http.url`, `http.host`, `http.status_code` on the span
- Respects `tracePropagationTargets` and the ingestion endpoint exclusion
- Never calls `new Request(...)` — reads `input.headers` directly (safe property access)

No capability regression: outgoing fetch tracing (span creation + trace propagation) is fully preserved.

`@opentelemetry/instrumentation-undici` is no longer a dependency.
