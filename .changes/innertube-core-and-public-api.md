---
type: patch
---

Add the Innertube core and the first public API. Sessions are established from YouTube's own client bootstrap (with a local fallback) and client identities are swapped per request. The SDK is a single class — `new YouTube()`, then `yt.video()`, `yt.search()`, `yt.transcript()`, `yt.channel()`, and `yt.suggestions()`. Construction does no I/O; the session is created on the first call. The same functionality is available as an Effect service (`YouTubeApi` / `layer`), failures surface as tagged errors, `search` follows continuations when given a `limit`, and the package still has no runtime dependency beyond `effect`.
