---
title: Guides
description: Build reliable scripts and services with pagination, tagged errors, shared clients, and the Effect-native provider.
group: Explore
order: 1
---

## Build a small search report

Search results form a discriminated union. Check `result.type` before reading
fields that belong only to videos, channels, or playlists.

```ts
import { YouTube } from 'just-yt';

const youtube = new YouTube();
const page = await youtube.search('typescript for beginners', {
  type: 'video',
  uploadDate: 'year',
  limit: 50,
});

const rows = page.results.flatMap((result) =>
  result.type === 'video'
    ? [{
        title: result.title,
        channel: result.author?.name ?? 'Unknown channel',
        views: result.viewCount ?? 0,
        url: result.url,
      }]
    : [],
);

console.table(rows.sort((a, b) => b.views - a.views));
await youtube.close();
```

Missing values are not silently changed to zero by the SDK. The example uses
`?? 0` only because this particular report needs a sortable fallback.

## Paginate without loading everything

`limit` is convenient for a known, modest number of results. For larger or
open-ended jobs, fetch one page at a time and persist the continuation token.

```ts
let continuation: string | undefined;

do {
  const page = await youtube.search('web development', {
    type: 'video',
    continuation,
  });

  await saveResults(page.results);
  continuation = page.continuation;
  await saveCheckpoint(continuation);
} while (continuation);
```

Continuation tokens are opaque and tied to YouTube's result feed. Do not parse
or edit them. They may expire, so a durable importer should be able to restart a
fresh search.

## Handle tagged errors

Promise methods reject with the SDK's tagged error objects. Narrow `unknown`
with `instanceof`, or inspect `_tag` when you prefer a switch.

```ts
import {
  ExtractionError,
  NetworkError,
  NotFoundError,
  UnavailableError,
} from 'just-yt';

try {
  return await youtube.transcript(videoId, { language: 'en' });
} catch (error) {
  if (error instanceof NotFoundError) {
    return null; // no matching video or caption track
  }

  if (error instanceof UnavailableError) {
    console.warn(error.status, error.reason);
    return null;
  }

  if (error instanceof NetworkError) {
    console.error('Network request failed:', error.url);
  }

  if (error instanceof ExtractionError) {
    // YouTube returned a renderer shape the installed SDK could not parse.
    console.error('Parser drift at:', error.path);
  }

  throw error;
}
```

An unavailable result is not automatically a bug: videos can be private,
age-gated, region-blocked, members-only, or refused to anonymous clients.
`ExtractionError` is different—it is a useful signal that YouTube may have
changed an undocumented response.

## Share a client in a server

Create the client outside the request handler so all calls reuse one session.

```ts
import { YouTube } from 'just-yt';

const youtube = new YouTube({ location: 'ZA' });

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  try {
    return Response.json(await youtube.video(id));
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 502 },
    );
  }
}
```

Call `close()` during your application's shutdown hook, not at the end of every
incoming request.

## Use the Effect provider

The Promise client is the recommended starting point. If your application
already uses Effect, `YouTubeApi` exposes the same operations as typed Effects,
and `layer()` provides its configuration, session, and Innertube transport.

```ts
import { Effect } from 'effect';
import { YouTubeApi, layer } from 'just-yt';

const program = Effect.gen(function* () {
  const youtube = yield* YouTubeApi;

  return yield* youtube.video('dQw4w9WgXcQ').pipe(
    Effect.catchTag('UnavailableError', (error) =>
      Effect.succeed({ unavailable: error.reason ?? error.status }),
    ),
  );
});

const result = await Effect.runPromise(
  program.pipe(Effect.provide(layer({ location: 'ZA' }))),
);
```

The service also provides streaming search. It follows continuations lazily and
stops when the stream is interrupted or YouTube runs out of results.

```ts
import { Effect, Stream } from 'effect';
import { YouTubeApi, layer } from 'just-yt';

const program = Effect.gen(function* () {
  const youtube = yield* YouTubeApi;

  return yield* youtube.searchStream('typescript', { type: 'video' }).pipe(
    Stream.take(100),
    Stream.runCollect,
  );
});

const results = await Effect.runPromise(program.pipe(Effect.provide(layer())));
```

For advanced integrations, the same layer also exposes `Innertube` and
`Session`. Those are lower-level APIs: raw Innertube response shapes are
undocumented and may change, so keep them behind your own adapter.

```ts
import { Effect } from 'effect';
import { Innertube, layer } from 'just-yt';

const rawBrowse = Effect.gen(function* () {
  const innertube = yield* Innertube;
  return yield* innertube.execute('/browse', { browseId: 'UC...' });
});

const response = await Effect.runPromise(
  rawBrowse.pipe(Effect.provide(layer())),
);
```
