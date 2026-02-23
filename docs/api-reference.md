# DeepTracer Ingestion API Reference

Base URL: `https://ingest.deeptracer.dev`

All `/ingest/*` endpoints require authentication and accept JSON payloads.

## Authentication

Include your API key in the `Authorization` header:

```
Authorization: Bearer dt_your_api_key_here
```

API keys are created in the dashboard under **Settings > API Keys**. Each key is scoped to a single project.

## Rate Limits

- **5,000 requests/minute** per API key
- **5 MB** max body size per request

Rate limit headers are included in every response:

| Header | Description |
|--------|-------------|
| `X-RateLimit-Limit` | Requests allowed per window |
| `X-RateLimit-Remaining` | Requests remaining |
| `X-RateLimit-Reset` | Unix timestamp when the window resets |

Returns `429 Too Many Requests` with `Retry-After` header when exceeded.

---

## POST /ingest/logs

Send a batch of log entries (1-1000 per request).

**Request:**

```bash
curl -X POST https://ingest.deeptracer.dev/ingest/logs \
  -H "Authorization: Bearer dt_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "my-app",
    "environment": "production",
    "logs": [
      {
        "level": "info",
        "message": "User signed up",
        "metadata": { "userId": "u_123", "plan": "pro" }
      },
      {
        "level": "error",
        "message": "Payment failed",
        "metadata": { "orderId": "ord_456", "reason": "card_declined" }
      }
    ]
  }'
```

**Response** (200):

```json
{ "ok": true, "count": 2 }
```

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `service` | string | no | `"unknown"` | Service name (e.g., `"web"`, `"api"`) |
| `environment` | string | no | `"production"` | Environment (e.g., `"staging"`, `"development"`) |
| `logs` | array | yes | — | Array of log entries (1-1000) |
| `logs[].level` | string | yes | — | `"debug"`, `"info"`, `"warn"`, or `"error"` |
| `logs[].message` | string | yes | — | Log message |
| `logs[].timestamp` | string | no | now | ISO 8601 timestamp |
| `logs[].metadata` | object | no | — | Arbitrary key-value data |
| `logs[].trace_id` | string | no | — | Trace ID for correlation |
| `logs[].span_id` | string | no | — | Span ID for correlation |
| `logs[].request_id` | string | no | — | Request ID |
| `logs[].context` | string | no | — | Logger context name |

---

## POST /ingest/errors

Report a single error with stack trace and optional context.

**Request:**

```bash
curl -X POST https://ingest.deeptracer.dev/ingest/errors \
  -H "Authorization: Bearer dt_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "my-app",
    "environment": "production",
    "error_message": "Cannot read properties of undefined (reading '\''id'\'')",
    "stack_trace": "TypeError: Cannot read properties of undefined\n    at getUser (/app/src/users.ts:42:15)\n    at handler (/app/src/api/route.ts:10:3)",
    "severity": "high",
    "context": { "userId": "u_123", "route": "/api/users" }
  }'
```

**Response** (200):

```json
{ "ok": true, "fingerprint": "a1b2c3d4e5f6..." }
```

The `fingerprint` is a SHA-256 hash used to group identical errors together.

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `service` | string | no | `"unknown"` | Service name |
| `environment` | string | no | `"production"` | Environment |
| `error_message` | string | **yes** | — | Error message text |
| `stack_trace` | string | **yes** | — | Full stack trace |
| `severity` | string | no | `"medium"` | `"low"`, `"medium"`, `"high"`, or `"critical"` |
| `context` | object | no | — | Arbitrary context data |
| `trace_id` | string | no | — | Trace ID for correlation |
| `user_id` | string | no | — | User ID |
| `breadcrumbs` | array | no | — | Recent actions leading to the error |
| `breadcrumbs[].type` | string | yes | — | Breadcrumb type (e.g., `"http"`, `"ui"`, `"navigation"`) |
| `breadcrumbs[].message` | string | yes | — | What happened |
| `breadcrumbs[].timestamp` | string | yes | — | ISO 8601 timestamp |

---

## POST /ingest/traces

Send a single distributed trace span.

**Request:**

```bash
curl -X POST https://ingest.deeptracer.dev/ingest/traces \
  -H "Authorization: Bearer dt_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "my-app",
    "environment": "production",
    "trace_id": "abc123def456",
    "span_id": "span_001",
    "parent_span_id": "",
    "operation": "GET /api/users",
    "start_time": "2026-02-23T00:00:00.000Z",
    "duration_ms": 145,
    "status": "ok",
    "metadata": { "http.status_code": 200 }
  }'
```

**Response** (200):

```json
{ "ok": true }
```

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `service` | string | no | `"unknown"` | Service name |
| `environment` | string | no | `"production"` | Environment |
| `trace_id` | string | **yes** | — | Trace ID (groups spans into a trace) |
| `span_id` | string | **yes** | — | Unique span identifier |
| `parent_span_id` | string | no | `""` | Parent span ID (empty for root spans) |
| `operation` | string | **yes** | — | Operation name (e.g., `"GET /api/users"`) |
| `start_time` | string | **yes** | — | ISO 8601 start timestamp |
| `duration_ms` | integer | **yes** | — | Duration in milliseconds (>= 0) |
| `status` | string | no | `"ok"` | `"ok"` or `"error"` |
| `metadata` | object | no | — | Arbitrary span attributes |

---

## POST /ingest/llm

Report LLM/AI model usage for cost and performance tracking.

**Request:**

```bash
curl -X POST https://ingest.deeptracer.dev/ingest/llm \
  -H "Authorization: Bearer dt_your_api_key" \
  -H "Content-Type: application/json" \
  -d '{
    "service": "my-app",
    "environment": "production",
    "model": "claude-sonnet-4-5-20250514",
    "provider": "anthropic",
    "operation": "chat.completion",
    "input_tokens": 1250,
    "output_tokens": 340,
    "cost_usd": 0.0089,
    "latency_ms": 2100,
    "metadata": { "feature": "support-chat" }
  }'
```

**Response** (200):

```json
{ "ok": true }
```

**Fields:**

| Field | Type | Required | Default | Description |
|-------|------|----------|---------|-------------|
| `service` | string | no | `"unknown"` | Service name |
| `environment` | string | no | `"production"` | Environment |
| `model` | string | **yes** | — | Model identifier (e.g., `"gpt-4o"`, `"claude-sonnet-4-5-20250514"`) |
| `provider` | string | **yes** | — | Provider name (e.g., `"openai"`, `"anthropic"`) |
| `operation` | string | **yes** | — | Operation type (e.g., `"chat.completion"`, `"embedding"`) |
| `input_tokens` | integer | **yes** | — | Input/prompt token count (>= 0) |
| `output_tokens` | integer | **yes** | — | Output/completion token count (>= 0) |
| `cost_usd` | number | no | `0` | Estimated cost in USD |
| `latency_ms` | integer | **yes** | — | Request latency in milliseconds (>= 0) |
| `metadata` | object | no | — | Arbitrary metadata |

---

## POST /ingest/drain

Vercel Log Drain webhook endpoint. Receives logs forwarded by Vercel's log drain integration.

This endpoint is configured in Vercel's project settings, not called directly. See [Vercel Log Drains](https://vercel.com/docs/observability/log-drains) for setup.

---

## GET /health

Liveness check. No authentication required.

```bash
curl https://ingest.deeptracer.dev/health
```

**Response** (200):

```json
{ "status": "ok", "timestamp": "2026-02-23T00:00:00.000Z" }
```

---

## Error Responses

All endpoints return JSON error responses:

**401 Unauthorized** — missing or invalid API key:

```json
{ "error": "Missing or invalid API key" }
```

**400 Bad Request** — validation failed (Zod error with field details):

```json
{
  "success": false,
  "error": {
    "issues": [
      {
        "code": "invalid_type",
        "expected": "string",
        "received": "undefined",
        "path": ["error_message"],
        "message": "Required"
      }
    ],
    "name": "ZodError"
  }
}
```

**429 Too Many Requests** — rate limit exceeded:

```json
{ "error": "Rate limit exceeded" }
```

**403 Forbidden** — origin not allowed:

```json
{ "error": "Origin not allowed" }
```

---

## Field Naming Convention

All API fields use **snake_case** (e.g., `trace_id`, `error_message`, `stack_trace`, `duration_ms`).

The JavaScript SDK accepts **camelCase** in its public API and translates to snake_case automatically. If you're calling the API directly (curl, Python, Go, etc.), use snake_case.

| SDK (camelCase) | API (snake_case) |
|-----------------|------------------|
| `inputTokens` | `input_tokens` |
| `outputTokens` | `output_tokens` |
| `latencyMs` | `latency_ms` |
| `costUsd` | `cost_usd` |
| `errorMessage` | `error_message` |
| `stackTrace` | `stack_trace` |
| `traceId` | `trace_id` |
| `spanId` | `span_id` |
| `parentSpanId` | `parent_span_id` |
| `startTime` | `start_time` |
| `durationMs` | `duration_ms` |
| `userId` | `user_id` |
| `requestId` | `request_id` |
