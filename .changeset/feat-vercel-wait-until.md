---
"@deeptracer/core": minor
"@deeptracer/nextjs": minor
---

feat: automatic Vercel waitUntil support for post-response background task logs

Logs written after the HTTP response is returned (e.g., from Better Auth's
`runInBackgroundOrAwait`, Stripe webhook processing, or any third-party library
that defers work past the response) were silently dropped on Vercel because the
function execution context is frozen after the response.

**`@deeptracer/nextjs`**: `register()` now automatically detects Vercel and wires
up `waitUntil` from `@vercel/functions`. No user action required — just upgrade.

**`@deeptracer/core`**: New optional `waitUntil` field on `LoggerConfig` for
non-Next.js deployments. On Cloudflare Workers, pass `ctx.waitUntil.bind(ctx)` when
creating the logger. On persistent servers (Railway, Fly, Docker) this field is not
needed — the timer-based flush handles it.
