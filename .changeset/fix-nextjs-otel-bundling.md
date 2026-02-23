---
"@deeptracer/nextjs": patch
---

Fix OpenTelemetry packages leaking into client bundle

Add `withDeepTracer()` config wrapper (`@deeptracer/nextjs/config`) that adds OTel packages to `serverExternalPackages`, preventing Webpack/Turbopack from bundling Node.js-only modules like `diagnostics_channel` into client chunks. Also add `/* webpackIgnore: true */` to dynamic OTel imports as defense-in-depth for Webpack.
