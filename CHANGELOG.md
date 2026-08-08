# Changelog

## 0.0.18 — 2026-08-08

- Add `recommended()`, which builds a home-page-style feed from video, query, and
channel seeds you supply. YouTube serves an anonymous session no home feed of
its own, so each seed is expanded against YouTube — a video contributes both its
watch-page sidebar and its mix, a query contributes search results, and a
channel contributes its recent uploads — and the candidates are then merged,
scored, and capped per channel.

Seeds accept a bare string or a `{ weight }` object for tuning relative
influence. Every returned item carries the seeds and endpoints that produced it,
so a feed can be explained; items that several seeds agree on rank higher. A
seed that fails is reported in `skipped` rather than failing the whole feed.

Adds the `FeedItem`, `FeedItemSource`, `RecommendedFeed`, and `SkippedSeed`
models, along with the `VideoSeed`, `QuerySeed`, `ChannelSeed`, and
`RecommendedOptions` input types.

## 0.0.17 — 2026-08-07

- Default the client timezone to `America/New_York` so the out-of-box US locale persona stays internally consistent instead of inheriting the host timezone.

## 0.0.16 — 2026-08-07

- Polish the documentation landing page layout, spacing, and responsive overflow behavior.

## 0.0.15 — 2026-08-07

- Return non-segmented transcripts as one whitespace-normalized paragraph with a single space between caption segments.

## 0.0.14 — 2026-08-07

- Route proxy-enabled requests through Bun's native fetch proxy support while retaining the session-scoped Undici transport on Node.js, and reject unsupported runtimes instead of silently bypassing the proxy.

## 0.0.13 — 2026-08-07

- Add first-class, session-scoped HTTP and HTTPS proxy support through the `proxy` constructor option, and report refused transcript requests as unavailable with YouTube's playability reason.

## 0.0.12 — 2026-08-07

- Return transcripts as titled text by default or clean timestamped segments with the `segmented` option.

## 0.0.11 — 2026-08-07

- Wait for npm registry propagation when verifying a newly published release.

## 0.0.10 — 2026-08-07

- Make automated releases retryable and verify npm publication before creating the GitHub Release.

## 0.0.9 — 2026-08-07

- Document the repository workflow for synchronizing CI-created release commits before starting new work.

## 0.0.8 — 2026-08-07

- Add bounded-concurrency bulk lookups for videos, channels, and transcripts with ordered, per-target success and failure results.

## 0.0.7 — 2026-08-06

- Reworked the documentation site. `/` now serves the opening page directly
instead of bouncing through a redirect, the sidebar is permanent rather than
collapsible, and code blocks gained a copy button. Alternatives such as install
commands are now tabbed instead of stacked, callouts are typed and colour-coded,
and the logo is a plain wordmark — the icon marks are gone from both the header
and the sidebar.

## 0.0.6 — 2026-08-05

- Add the complete just-yt documentation site to the SDK repository so the public
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

## 0.0.5 — 2026-08-05

- Add the Innertube core and the first public API. Sessions are established from YouTube's own client bootstrap (with a local fallback) and client identities are swapped per request. The SDK is a single class — `new YouTube()`, then `yt.video()`, `yt.search()`, `yt.transcript()`, `yt.channel()`, and `yt.suggestions()`. Construction does no I/O; the session is created on the first call. The same functionality is available as an Effect service (`YouTubeApi` / `layer`), failures surface as tagged errors, `search` follows continuations when given a `limit`, and the package still has no runtime dependency beyond `effect`.

## 0.0.4 — 2026-08-04

- Make automated releases resilient to overlapping workflow runs and ensure release tags are pushed explicitly.

## 0.0.3 — 2026-08-04

- Streamline the README to document only the current project status and development setup.

## 0.0.2 — 2026-08-04

- Add a basic `Client` example and an `example:basic` development script.
