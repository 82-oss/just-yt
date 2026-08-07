---
title: Quickstart
description: Learn the core Promise API by searching YouTube and reading video, transcript, channel, and suggestion data.
group: Documentation
order: 2
---

The `YouTube` class is the simplest way to use `just-yt`. Its methods return
Promises, so they work with familiar `async` / `await` TypeScript.

```ts
import { YouTube } from 'just-yt';

const youtube = new YouTube();
```

## Search with filters

Without a `limit`, `search` fetches one YouTube results page. Set `limit` to
collect up to that many results; the SDK follows YouTube's continuation tokens
for you.

```ts
const page = await youtube.search('learn typescript', {
  type: 'video',
  uploadDate: 'month',
  duration: 'medium',
  sortBy: 'view_count',
  features: ['hd', 'subtitles'],
  limit: 25,
});

for (const result of page.results) {
  // The type filter asks YouTube for videos. Still narrow the union because
  // YouTube can occasionally include another renderer in a results page.
  if (result.type === 'video') {
    console.log(result.title, result.url);
  }
}
```

Available filters include `video`, `channel`, `playlist`, `movie`, and `short`
for `type`; recent upload periods; video duration; sort order; and features such
as subtitles, live, 4K, HDR, and Creative Commons.

## Continue from a saved page

YouTube returns an opaque `continuation` token when another page is available.
Save it and pass it back unchanged when you want manual pagination.

```ts
const first = await youtube.search('effect typescript');

if (first.continuation) {
  const second = await youtube.search('effect typescript', {
    continuation: first.continuation,
  });

  console.log(second.results);
}
```

## Read video details

`video` accepts IDs and common URL forms including `watch?v=`, `youtu.be`,
`/shorts/`, `/embed/`, and `/live/`.

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

By default, the SDK makes an extra request to enrich the result with values
such as likes, comments, channel subscribers, and the channel avatar. Use basic
mode when you prefer a faster request and do not need those fields:

```ts
const basicVideo = await youtube.video('jNQXAC9IVRw', { basic: true });
```

## Read several videos safely

Plural lookup methods process two targets at a time by default. Set
`concurrency` from `1` through `4` to control how many complete target
operations can be active at once.

```ts
const results = await youtube.videos(
  [
    'jNQXAC9IVRw',
    'https://youtu.be/dQw4w9WgXcQ',
    'an unavailable video id',
  ],
  { concurrency: 2 },
);

for (const result of results) {
  if (result.ok) {
    console.log(result.target, result.value.title);
  } else {
    console.warn(result.target, result.error._tag);
  }
}
```

The returned array remains aligned with the input array even when requests
finish out of order. A deleted video, timeout, or extraction error becomes a
failed result item and does not discard successful items. `channels()` and
`transcripts()` provide the same behavior for their respective resource types.

## Read a transcript

`transcript` uses the caption tracks published for a video. By default it picks
a human-written track when possible, then falls back to an auto-generated one.

```ts
const transcript = await youtube.transcript('dQw4w9WgXcQ');

console.log(transcript.text);

for (const segment of transcript.segments) {
  console.log(segment.startSeconds, segment.endSeconds, segment.text);
}
```

Ask for a language by its code or by the caption name shown by YouTube:

```ts
const spanish = await youtube.transcript('dQw4w9WgXcQ', {
  language: 'es',
});
```

If the requested track does not exist, the Promise rejects with a
`NotFoundError`. The error message lists the available tracks.

## Read a channel

Use a channel ID, an `@handle`, or a YouTube channel URL.

```ts
const channel = await youtube.channel('@veritasium');

console.log(channel.title);
console.log(channel.subscriberCountText);
console.log(channel.description);
console.log(channel.links);
```

## Get autocomplete suggestions

```ts
const suggestions = await youtube.suggestions('type scr');

for (const suggestion of suggestions) {
  console.log(suggestion);
}
```

The [guides](/docs/guides) cover reliable application patterns and the Effect
provider. The [API reference](/docs/api) lists every method, option, model, and
error.
