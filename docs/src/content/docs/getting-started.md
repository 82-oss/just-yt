---
title: Getting started
description: Install just-yt and make your first typed requests for public YouTube data—without a YouTube Data API key.
group: Documentation
order: 1
---

`just-yt` is a TypeScript SDK for reading public YouTube data. It can search
YouTube, inspect videos and channels, read captions as transcripts, and fetch
autocomplete suggestions.

Unlike the official YouTube Data API, `just-yt` does not require you to create a
Google Cloud project or supply an API key. It talks to the same internal
Innertube service used by YouTube's own clients and turns the changing response
format into stable, typed objects.

> **Use it for public data only.** The SDK does not sign in, read private or
> members-only content, download media, or bypass YouTube's access controls.

## What you need

You should have a TypeScript project and a runtime with the standard `fetch`,
`URL`, and `Response` APIs. Node.js 18 or newer, Bun, Deno, and modern edge
runtimes provide these APIs.

Install the package with your preferred package manager:

```bash
npm install just-yt
```

```bash
pnpm add just-yt
```

```bash
bun add just-yt
```

The package includes its own TypeScript declarations. You do not need an
additional `@types` package.

## Create one client

Import `YouTube` and create a client. No API key is needed.

```ts
import { YouTube } from 'just-yt';

const youtube = new YouTube();
```

Creating the object does not make a network request. The first method call
creates a session, and later calls reuse it. Keep one client for the lifetime of
your application or job instead of creating one for every request.

## Make your first request

You can give `video` either an 11-character video ID or a normal YouTube URL.

```ts
const video = await youtube.video('https://www.youtube.com/watch?v=jNQXAC9IVRw');

console.log(video.title);
console.log(video.channel.name);
console.log(video.viewCount);
```

The result is a plain JavaScript object. TypeScript knows that `title` is a
string and that fields YouTube may omit, such as `viewCount`, can be
`undefined`. Check optional values instead of assuming every video has them:

```ts
if (video.likeCount !== undefined) {
  console.log(`${video.likeCount.toLocaleString()} likes`);
}
```

## Search YouTube

`search` returns a mixed list of videos, channels, and playlists. The `type`
field lets TypeScript narrow each result to the right shape.

```ts
const page = await youtube.search('typescript tutorial', { limit: 10 });

for (const result of page.results) {
  if (result.type === 'video') {
    console.log(result.title, result.durationText);
  } else if (result.type === 'channel') {
    console.log(result.title, result.subscriberCountText);
  } else {
    console.log(result.title, result.videoCount);
  }
}
```

## Close the client

Long-running servers normally keep the client open. Short scripts should close
it when they finish so the managed runtime can release its resources.

```ts
try {
  const video = await youtube.video('jNQXAC9IVRw');
  console.log(video.title);
} finally {
  await youtube.close();
}
```

Next, follow the [quickstart](/docs/quickstart) for each common operation, then
use [configuration](/docs/configuration) when you need locale, timeout, retry,
or custom network settings.
