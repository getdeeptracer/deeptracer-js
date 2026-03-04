---
"@deeptracer/core": patch
---

fix: use synthetic call-site stack when error has no stack trace

When an error has no `.stack` property (Bun network errors, string throws,
errors from some edge runtimes), `captureError` now falls back to a synthetic
stack captured at the call site. SDK-internal frames are filtered out so only
user code frames are shown. Errors that already have a `.stack` are unaffected.
