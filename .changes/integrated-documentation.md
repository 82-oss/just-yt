---
type: patch
---

Add the complete just-yt documentation site to the SDK repository so the public
API, examples, and guides can evolve together. The new beginner-friendly
documentation explains how to install the package without a YouTube Data API
key, create and reuse a session-backed `YouTube` client, and safely close it in
short-lived scripts.

Document every high-level Promise operation with TypeScript examples: filtered
and paginated search, video metadata, caption-backed transcripts, channel
details, and autocomplete suggestions. Explain optional YouTube response fields,
search-result type narrowing, continuation tokens, transcript language
selection, basic video mode, unavailable public content, and the SDK's scope and
access limitations.

Add detailed configuration guidance for locale and region, timeouts and retries,
custom `fetch` implementations and proxy routing, anonymous visitor data,
Proof-of-Origin tokens, restricted mode, session initialization, and predefined
YouTube client profiles. Include application guides for building reports,
checkpointing large searches, sharing one client in a server, and handling every
tagged error without losing TypeScript safety.

Document the Effect-native provider, streaming search, the complete `layer()`
stack, and advanced access to the lower-level `Session` and `Innertube` services.
Add a full API and domain-model reference covering search, video, transcript,
channel, thumbnail, author, caption, configuration, client, and error types.

Integrate the Astro site as a private pnpm workspace package with root
`docs:dev` and `docs:build` commands. The published npm package remains limited
to its existing compiled `dist` output and package documentation; the Astro
project is not included in the npm tarball.
