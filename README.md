# just-yt

A type-safe TypeScript SDK for extracting public data from YouTube without requiring an official YouTube Data API key.

It talks to YouTube's internal Innertube endpoints the way YouTube's own clients do — one session per client instance, with the client identity swapped per request when an endpoint demands it. Effect powers the internals (typed errors, retries, timeouts, dependency injection); the default public API is plain Promises.

## Install

```bash
pnpm add just-yt
```

## Usage

```ts
import { createClient } from "just-yt";

const yt = await createClient();

// Search, with filters and pagination
const page = await yt.search("effect ts", { type: "video", uploadDate: "week" });
const many = await yt.searchAll("effect ts", { limit: 100 });

// Video details
const video = await yt.getVideo("https://www.youtube.com/watch?v=jNQXAC9IVRw");
video.title; // "Me at the zoo"
video.viewCount; // 403130789
video.likeCount; // 19300458
video.channel.handle; // "@jawed"

// Transcripts
const transcript = await yt.getTranscript("dQw4w9WgXcQ", { language: "en" });
transcript.text; // full text
transcript.segments; // [{ startMs, endMs, startSeconds, endSeconds, text }, …]

// Channels — by handle, id, or URL
const channel = await yt.getChannel("@veritasium");
channel.subscriberCount; // 21100000
channel.joinedDateText; // "Joined Jul 21, 2010"

await yt.close();
```

Create one client and reuse it: session creation costs a couple of network round-trips, and YouTube treats a session whose identity drifts between requests with suspicion.

### Effect API

The same functionality, as a service:

```ts
import { Effect } from "effect";
import { YouTube, layer } from "just-yt";

const program = Effect.gen(function* () {
  const yt = yield* YouTube;

  return yield* yt.getVideo("dQw4w9WgXcQ").pipe(
    Effect.catchTag("UnavailableError", (error) =>
      Effect.succeed(`unavailable: ${error.reason}`),
    ),
  );
});

Effect.runPromise(program.pipe(Effect.provide(layer())));
```

`layer()` also provides `Innertube` and `Session`, so you can call endpoints this library does not wrap:

```ts
const raw = yield* (yield* Innertube).execute("/browse", { browseId: "UC…" });
```

Search pagination is available as a `Stream`:

```ts
yt.searchStream("effect ts", { type: "video" }).pipe(
  Stream.take(500),
  Stream.runCollect,
);
```

## Errors

Every failure is a tagged error — `NetworkError`, `SessionError`, `InnertubeError`, `ExtractionError`, `NotFoundError`, `UnavailableError` — usable with `Effect.catchTag` or, on the Promise API, by checking `error._tag`. `ExtractionError` is the one to watch: it means YouTube reshaped a response, and its `path` field points at where extraction gave up.

## Scope

Public metadata only: search, video details, transcripts, and channel details. There is no signature deciphering, format selection, or downloading, and no authenticated access — no OAuth, no cookies, no private or subscriber-only data.

Anonymous access is not guaranteed. YouTube may refuse individual videos regardless of client identity; a `poToken` improves compatibility on some endpoints but is not a bypass for anti-abuse systems.

## Development

```bash
pnpm install
pnpm typecheck
pnpm build
pnpm example:basic
```

## License

MIT
