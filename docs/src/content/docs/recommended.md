---
title: Recommended feeds
label: Recommended
description: Build a home-page-style feed from video, query, and channel seeds you supply, with weighting, scoring, and per-channel limits.
group: Features
order: 5
---

`recommended()` builds a YouTube-home-page-style feed out of seeds you supply.

## Why seeds

YouTube has no logged-out home feed to read. Asking for one anonymously returns
a placeholder telling you to sign in and start watching — no videos at all.

That is the whole reason this method takes seeds. YouTube's own recommendations
are driven by who is watching, and an anonymous session is nobody. Supplying
seeds replaces the missing viewer: you state what the feed should be about, and
`recommended()` expands that into candidates and ranks them.

## Three kinds of seed

```ts
const feed = await yt.recommended({
  videos: ['aircAruvnKk', 'dQw4w9WgXcQ'],
  queries: ['effect ts', 'how do transformers work'],
  channels: ['@veritasium', '@3blue1brown'],
});
```

Every seed is just a different way to find candidates. All three are optional,
and you can pass as many of each as you like.

| Seed | Answers | Fetched from |
| --- | --- | --- |
| `videos` | More videos like this one | The watch page sidebar and the video's mix |
| `queries` | Videos about this topic | Search |
| `channels` | Recent videos from this creator | The channel's uploads |

A video seed contributes two independent lists — the sidebar and YouTube's own
`RDMM` radio queue for that video. The two overlap surprisingly little, so
taking both widens coverage rather than reinforcing the same picks.

## Weighting a seed

Any seed can be an object instead of a string when you want to tune it. A bare
string means a weight of `1`.

```ts
const feed = await yt.recommended({
  videos: [
    'aircAruvnKk',
    { video: 'dQw4w9WgXcQ', weight: 0.3 },
  ],
  queries: [{ query: 'rust async runtimes', weight: 1.5 }],
  channels: [{ channel: '@3blue1brown', weight: 3 }],
});
```

Weight is relative, not a quota. `weight: 3` does not mean three videos — it
means results from that seed score about three times as strongly, so more of
them survive into the final feed. A weight of `0` mutes a seed without removing
it.

## Reading the feed

```ts
const feed = await yt.recommended({ videos: ['aircAruvnKk'] });

for (const item of feed.items) {
  item.title; // 'Gradient descent, how neural networks learn'
  item.author?.name; // '3Blue1Brown'
  item.durationText; // '20:33'
  item.score; // 1.9
  item.sources; // [{ seed: 'aircAruvnKk', kind: 'video', via: 'related' }, …]
}
```

Feed entries are preview cards, not full videos. YouTube sends a title, a
channel, a duration and a couple of count strings per item and nothing more, so
`FeedItem` is a smaller type than `VideoDetails` rather than that type with
every field made optional. Pass an `id` to `video()` when you need the rest.

```ts
const full = await yt.video(feed.items[0].id);
```

### Scores and sources

`score` ranks items within one feed and means nothing between feeds. It combines
the seed's weight, the position YouTube returned the item at, and how much the
source is worth — a mix counts for more than the sidebar, which counts for more
than search.

Scores from every source that produced an item are added together, so an item
two different seeds both point at outranks one only a single seed found. That
agreement is recorded in `sources`, which is also the field to read when you
want to know why something is in the feed.

## Seeds that produce nothing

A feed is an aggregate, so one bad seed costs its own results and nothing else.
Failures are collected instead of rejecting the call.

```ts
const feed = await yt.recommended({
  videos: ['not-a-video-id', 'aircAruvnKk'],
});

feed.items.length; // 25 — the good seed still worked
feed.skipped;
// [{ seed: 'not-a-video-id', kind: 'video',
//    reason: 'NotFoundError: Could not read a video id from "not-a-video-id"' }]
```

Check `skipped` when a feed comes back thinner than you expected. A seed that
simply had no results is reported there too.

## Keeping one channel from taking over

```ts
const feed = await yt.recommended({
  channels: ['@veritasium'],
  limit: 100,
  maxPerChannel: 2,
});
```

`limit` defaults to `50` and `maxPerChannel` to `3`. The cap is applied after
ranking, so a channel keeps its best entries rather than its first ones.
Without it a single prolific uploader crowds out everything else and the
recommendation feed quietly becomes a channel feed.

Seed videos are never returned as results — a seed is the question, not part of
the answer.

## Concurrency

```ts
const feed = await yt.recommended({
  videos: ['aircAruvnKk', 'dQw4w9WgXcQ'],
  concurrency: 4,
});
```

Seeds are expanded two at a time by default, and the ceiling is `4`, matching
the other bulk lookups. Remember that each video seed makes two requests.

## What to expect from the results

Feed quality varies with the seed, and it is worth knowing where the soft spots
are.

A video with a dense topical neighbourhood — a well-covered subject, an active
channel — produces strongly on-topic results. A video without one falls back to
whatever is popular in your region, which is why a niche or very old video can
return a feed that looks unrelated to it. Query and channel seeds do not have
this failure mode, so mixing seed kinds is the practical defence.

Results also depend on `location`, since YouTube personalises by region even for
anonymous sessions. Two sessions in different regions will not return the same
feed for the same seeds. Within a single client instance the results are stable;
across instances they are not, because each new client is a new session.

Some sessions receive a compact metadata format that omits view counts entirely.
`viewCount` and `viewCountText` are optional for that reason — check before
using them rather than assuming they are present.
