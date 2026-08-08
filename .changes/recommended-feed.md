---
type: patch
---

Add `recommended()`, which builds a home-page-style feed from video, query, and
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
