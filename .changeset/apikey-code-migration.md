---
"@deeptracer/core": patch
"@deeptracer/node": patch
"@deeptracer/react": patch
"@deeptracer/nextjs": patch
---

Migrate source code from secretKey/publicKey to single apiKey field. Server env var is now DEEPTRACER_KEY (was DEEPTRACER_SECRET_KEY). Client env var stays NEXT_PUBLIC_DEEPTRACER_KEY.
