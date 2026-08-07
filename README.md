# just-yt

A type-safe TypeScript SDK for extracting public data from YouTube without requiring an official YouTube Data API key.

It talks to YouTube's internal Innertube endpoints the way YouTube's own clients do — one session per client instance, with the client identity swapped per request when an endpoint demands it. Effect powers the internals (typed errors, retries, timeouts, dependency injection); the default public API is plain Promises.

## Install

```bash
pnpm add just-yt
```

## Usage

```ts
import { YouTube } from "just-yt";

const yt = new YouTube();

// Videos — id, watch URL, youtu.be, /shorts/, /embed/, /live/
const video = await yt.video("https://www.youtube.com/watch?v=jNQXAC9IVRw");
video.title; // "Me at the zoo"
video.viewCount; // 403130789
video.likeCount; // 19300458
video.channel.handle; // "@jawed"

// Search — one page by default, or set a limit to follow continuations
const page = await yt.search("effect ts", { type: "video", uploadDate: "week" });
const many = await yt.search("effect ts", { limit: 100 });
const more = await yt.search("effect ts", { continuation: page.continuation });

// Transcripts
const transcript = await yt.transcript("dQw4w9WgXcQ", { language: "en" });
transcript.title; // video title
transcript.data; // complete transcript with blank lines between segments

const timed = await yt.transcript("dQw4w9WgXcQ", { segmented: true });
timed.data; // [{ start, end, text }, …], with timestamps in seconds

// Channels — by handle, id, or URL
const channel = await yt.channel("@veritasium");
channel.subscriberCount; // 21100000
channel.joinedDateText; // "Joined Jul 21, 2010"

// Bulk lookups — two targets at a time by default, configurable up to four.
// Every input gets an ordered success or failure result.
const videos = await yt.videos([
  "jNQXAC9IVRw",
  "https://youtu.be/dQw4w9WgXcQ",
], { concurrency: 2 });

for (const result of videos) {
  if (result.ok) console.log(result.target, result.value.title);
  else console.warn(result.target, result.error._tag);
}

// Autocomplete
const suggestions = await yt.suggestions("effect t");

await yt.close();
```

The constructor does no I/O — the Innertube session is established on the first call. Create one instance and keep it: YouTube treats a session whose identity drifts between requests with suspicion, and every instance is a new session.

Options go on the constructor:

```ts
const yt = new YouTube({
  lang: "es",
  location: "ES",
  fetch: myProxiedFetch, // how you route through a proxy today
  timeoutMillis: 30_000,
  retries: 3,
});
```

### Effect API

The same functionality, as a service:

```ts
import { Effect } from "effect";
import { YouTubeApi, layer } from "just-yt";

const program = Effect.gen(function* () {
  const yt = yield* YouTubeApi;

  return yield* yt.video("dQw4w9WgXcQ").pipe(
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

Search results are also available as a `Stream`:

```ts
yt.searchStream("effect ts", { type: "video" }).pipe(
  Stream.take(500),
  Stream.runCollect,
);
```

## Errors

Every failure is a tagged error — `NetworkError`, `SessionError`, `InnertubeError`, `ExtractionError`, `NotFoundError`, `UnavailableError` — usable with `Effect.catchTag` or, on the Promise API, by checking `error._tag`. `ExtractionError` is the one to watch: it means YouTube reshaped a response, and its `path` field points at where extraction gave up.

Bulk lookups capture expected failures on their individual result items rather
than rejecting the whole operation. The overall Promise rejects only when the
batch itself cannot run, such as a session initialization failure.

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
