---
"@deeptracer/nextjs": patch
"@deeptracer/core": patch
---

fix: source map upload now fast-fails on first error; browser transport uses keepalive for reliable delivery on page unload

- `@deeptracer/nextjs` config: stop uploading remaining source map chunks immediately when any chunk returns a non-OK response (4xx or 5xx). Previously the loop continued through all chunks, causing builds to hang for several minutes when the endpoint was unreachable or returned auth errors. Chunk request timeout also reduced from 30s to 10s.
- `@deeptracer/core` transport: set `keepalive: true` on all browser fetch requests so in-flight events (errors, logs) are delivered even when the user closes or navigates away from the tab mid-flight. Node.js silently ignores this flag.
