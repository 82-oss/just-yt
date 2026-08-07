---
type: patch
---
Route proxy-enabled requests through Bun's native fetch proxy support while retaining the session-scoped Undici transport on Node.js, and reject unsupported runtimes instead of silently bypassing the proxy.
