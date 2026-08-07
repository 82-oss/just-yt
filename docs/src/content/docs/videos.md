---
title: Video details
label: Videos
description: Read stable video metadata from an ID or URL, understand optional values, and choose between full and basic mode.
group: Features
order: 2
---

Use `video()` when you already know which video you want and need more detail
than a search result provides.

## IDs and URLs both work

```ts
const byId = await youtube.video('jNQXAC9IVRw');
const byUrl = await youtube.video(
  'https://www.youtube.com/watch?v=jNQXAC9IVRw',
);
```

Common `watch`, `youtu.be`, `shorts`, `embed`, and `live` URL forms are
accepted. Internally, the SDK extracts the video ID before requesting metadata.

## Read the result

```ts
const video = await youtube.video('jNQXAC9IVRw');

console.log({
  title: video.title,
  channel: video.channel.name,
  durationSeconds: video.durationSeconds,
  views: video.viewCount,
  publishedAt: video.publishedAt,
  captions: video.captions,
});
```

Optional values are `undefined` when YouTube did not supply them. The SDK does
not turn a missing like count into zero. Dates remain strings so their original
meaning is preserved.

## Choose full or basic mode

By default, the SDK enriches player metadata with another request. This can add
likes, comments, channel subscribers, and the channel avatar.

When those values do not matter, basic mode skips the enrichment request:

```ts
const video = await youtube.video('jNQXAC9IVRw', { basic: true });
```

Basic mode is useful for a quick lookup or a large job that only needs core
fields. It trades completeness for less work; it does not change the object
type.

## Read several videos

```ts
const results = await youtube.videos(videoIds, { concurrency: 2 });
```

Use the plural method when each target should succeed or fail independently.
See [concurrency](/docs/concurrency) before increasing the limit, and
[handling errors](/docs/guides) for reading each result.
