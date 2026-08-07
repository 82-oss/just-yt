---
title: Using Effect
label: Effect
description: Use the Effect-native service, typed error channels, streams, and dependency layers when your application already uses Effect.
group: Advanced
order: 1
---

The Promise client is the recommended starting point. If your application
already uses Effect, `YouTubeApi` exposes the same operations as typed Effects,
and `layer()` provides configuration, session, and transport dependencies.

## Provide the service

```ts
import { Effect } from 'effect';
import { YouTubeApi, layer } from 'just-yt';

const program = Effect.gen(function* () {
  const yt = yield* YouTubeApi;
  return yield* yt.video('dQw4w9WgXcQ');
});

const video = await Effect.runPromise(
  program.pipe(Effect.provide(layer({ location: 'ZA' }))),
);
```

The layer creates one shared session for the provided program. Configuration is
the same `YouTubeOptions` used by the Promise constructor.

## Handle a typed failure

```ts
const program = Effect.gen(function* () {
  const yt = yield* YouTubeApi;

  return yield* yt.video('dQw4w9WgXcQ').pipe(
    Effect.catchTag('UnavailableError', (error) =>
      Effect.succeed({ unavailable: error.reason ?? error.status }),
    ),
  );
});
```

Effect keeps expected failures in the error channel, so `catchTag` can target
one case without flattening every error into `unknown`.

## Stream search results

The Effect service also offers `searchStream()`. It follows continuations
lazily and stops when interrupted or when YouTube runs out of results.

```ts
import { Effect, Stream } from 'effect';
import { YouTubeApi, layer } from 'just-yt';

const program = Effect.gen(function* () {
  const yt = yield* YouTubeApi;

  return yield* yt.searchStream('typescript', { type: 'video' }).pipe(
    Stream.take(100),
    Stream.runCollect,
  );
});

const results = await Effect.runPromise(
  program.pipe(Effect.provide(layer())),
);
```

For advanced adapters, the layer also exposes `Innertube` and `Session`. Their
raw response shapes are undocumented and may change, so keep them behind your
own stable boundary.
