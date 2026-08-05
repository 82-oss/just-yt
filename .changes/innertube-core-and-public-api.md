---
type: patch
---

Add the Innertube core and the first public API. Sessions are established from YouTube's own client bootstrap (with a local fallback), client identities are swapped per request, and the SDK exposes `search`, `getVideo`, `getTranscript`, and `getChannel` through both a Promise client (`createClient`) and an Effect service (`YouTube` / `layer`). Failures surface as tagged errors, search pagination is available as an `Effect` stream, and the package still has no runtime dependency beyond `effect`.
