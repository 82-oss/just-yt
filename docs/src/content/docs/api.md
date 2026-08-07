---
title: API reference
description: Reference for the Promise client, Effect provider, options, domain models, lower-level services, and tagged errors.
group: Explore
order: 2
---

All examples import from the package root:

```ts
import { YouTube } from 'just-yt';
```

## Promise client

### `new YouTube(options?)`

Creates a client without doing I/O. The first operation initializes one shared
Innertube session. See [configuration](/docs/configuration) for `YouTubeOptions`.

### `search(query, options?)`

```ts
search(query: string, options?: SearchOptions): Promise<SearchPage>
```

Returns one page by default. `limit` follows continuations until that many
results have been collected or the feed ends.

```ts
interface SearchOptions {
  limit?: number;
  continuation?: string;
  type?: 'video' | 'channel' | 'playlist' | 'movie' | 'short';
  uploadDate?: 'any' | 'hour' | 'today' | 'week' | 'month' | 'year';
  duration?: 'any' | 'short' | 'medium' | 'long';
  sortBy?: 'relevance' | 'rating' | 'upload_date' | 'view_count';
  features?: readonly SearchFeature[];
}
```

`SearchFeature` is `'hd' | 'subtitles' | 'creative_commons' | '3d' | 'live' |
'purchased' | '4k' | '360' | 'location' | 'hdr' | 'vr180'`.

### `suggestions(query)`

```ts
suggestions(query: string): Promise<readonly string[]>
```

Returns YouTube autocomplete suggestions for a partial query.

### `video(target, options?)`

```ts
video(target: string, options?: VideoOptions): Promise<VideoDetails>

interface VideoOptions {
  basic?: boolean;
  client?: ClientType;
}
```

`target` can be a video ID or a `watch`, `youtu.be`, `shorts`, `embed`, or
`live` URL. `basic: true` skips enrichment from `/next`, which can omit like
count, comment count, subscriber count, and channel avatar.

### `videos(targets, options?)`

```ts
videos(
  targets: readonly string[],
  options?: VideosOptions,
): Promise<readonly BatchResult<VideoDetails>[]>

interface VideosOptions extends VideoOptions, BatchOptions {}
```

Processes several video IDs or URLs with bounded concurrency. Results have the
same order and length as `targets`; one failed video does not reject or cancel
the other lookups.

### `transcript(target, options?)`

```ts
transcript(target: string, options?: TranscriptOptions): Promise<Transcript>
transcript(
  target: string,
  options: SegmentedTranscriptOptions,
): Promise<SegmentedTranscript>

interface TranscriptOptions {
  language?: string;
  client?: ClientType;
  segmented?: false;
}

interface SegmentedTranscriptOptions {
  language?: string;
  client?: ClientType;
  segmented: true;
}
```

`language` matches a caption track by language code or displayed name. Without
it, the SDK prefers a human-written track and then an auto-generated track.
The default result contains the complete transcript as a string. Set
`segmented: true` to receive timestamped segments instead. Both modes remove
caption line breaks and YouTube's `>>` speaker markers.

### `transcripts(targets, options?)`

```ts
transcripts(
  targets: readonly string[],
  options?: TranscriptsOptions,
): Promise<readonly BatchResult<Transcript>[]>

transcripts(
  targets: readonly string[],
  options: SegmentedTranscriptsOptions,
): Promise<readonly BatchResult<SegmentedTranscript>[]>

interface TranscriptsOptions extends TranscriptOptions, BatchOptions {}
interface SegmentedTranscriptsOptions
  extends SegmentedTranscriptOptions, BatchOptions {}
```

Processes several transcripts while capturing missing captions and other
target-specific failures on the corresponding result item.

### `channel(target)`

```ts
channel(target: string): Promise<ChannelDetails>
```

Accepts a channel ID beginning with `UC`, an `@handle`, or a channel URL.

### `channels(targets, options?)`

```ts
channels(
  targets: readonly string[],
  options?: ChannelsOptions,
): Promise<readonly BatchResult<ChannelDetails>[]>

interface ChannelsOptions extends BatchOptions {}
```

Processes several channel IDs, handles, or URLs with ordered, per-target
results.

### Bulk options and results

All plural lookup methods default to two active targets. Concurrency is the
number of complete target operations in flight, not a division into fixed-size
batches. It can be lowered to `1` or raised as high as `4`.

```ts
interface BatchOptions {
  concurrency?: 1 | 2 | 3 | 4;
}

type BatchResult<T> =
  | { ok: true; target: string; value: T }
  | { ok: false; target: string; error: YouTubeError };
```

As soon as one target finishes, the next target starts in its place. Expected
lookup errors—including unavailable resources, exhausted network retries, and
extraction failures—are returned on the affected item. The overall operation
can still fail when its shared infrastructure cannot run, such as when session
initialization fails.

### `close()`

```ts
close(): Promise<void>
```

Disposes the client's managed runtime.

## Search models

```ts
interface SearchPage {
  results: readonly SearchResult[];
  estimatedResults?: number;
  continuation?: string;
}

type SearchResult =
  | VideoSearchResult
  | ChannelSearchResult
  | PlaylistSearchResult;
```

All results have a `type` discriminator, `id`, `title`, `url`, and thumbnails.

| Type | Notable fields |
| --- | --- |
| `VideoSearchResult` | `type: 'video'`, `description?`, `durationSeconds?`, `durationText?`, `author?`, `publishedText?`, `viewCount?`, `isLive`, `badges` |
| `ChannelSearchResult` | `type: 'channel'`, `handle?`, `description?`, `subscriberCount?`, `videoCountText?`, `isVerified` |
| `PlaylistSearchResult` | `type: 'playlist'`, `videoCount?`, `author?` |

## Video model

```ts
interface VideoDetails {
  id: string;
  title: string;
  url: string;
  description?: string;
  durationSeconds?: number;
  thumbnails: readonly Thumbnail[];
  channel: AuthorRef & {
    subscriberCount?: number;
    subscriberCountText?: string;
  };
  viewCount?: number;
  likeCount?: number;
  commentCount?: number;
  publishedAt?: string;
  uploadedAt?: string;
  publishedText?: string;
  category?: string;
  keywords: readonly string[];
  isLive: boolean;
  isLiveContent: boolean;
  isUpcoming: boolean;
  isPrivate: boolean;
  isUnlisted: boolean;
  isFamilySafe?: boolean;
  allowRatings?: boolean;
  captions: readonly CaptionTrack[];
  availableCountries: readonly string[];
  playabilityStatus: string;
  playabilityReason?: string;
}
```

Dates are strings, not `Date` objects. Optional numeric fields mean “YouTube did
not supply this value,” not zero.

## Transcript model

```ts
interface Transcript {
  title: string;
  data: string;
}

interface SegmentedTranscript {
  title: string;
  data: readonly TranscriptSegment[];
}

interface TranscriptSegment {
  start: number;
  end: number;
  text: string;
}

interface CaptionTrack {
  languageCode: string;
  name?: string;
  isAutoGenerated: boolean;
  isTranslatable: boolean;
}
```

The default `data` joins cleaned caption segments with a blank line between
them. Segmented `start` and `end` values are measured in seconds. Segment text
is normalized to one line, and neither mode includes YouTube's `>>` speaker
markers.

## Channel model

```ts
interface ChannelDetails {
  id: string;
  title: string;
  handle?: string;
  url: string;
  canonicalUrl?: string;
  description?: string;
  thumbnails: readonly Thumbnail[];
  banner: readonly Thumbnail[];
  subscriberCount?: number;
  subscriberCountText?: string;
  videoCount?: number;
  videoCountText?: string;
  viewCount?: number;
  viewCountText?: string;
  joinedDateText?: string;
  country?: string;
  keywords: readonly string[];
  tags: readonly string[];
  links: readonly ChannelLink[];
  isFamilySafe?: boolean;
  isVerified: boolean;
}
```

## Shared models

```ts
interface Thumbnail {
  url: string;
  width?: number;
  height?: number;
}

interface AuthorRef {
  id?: string;
  name?: string;
  handle?: string;
  url?: string;
  thumbnails: readonly Thumbnail[];
  isVerified: boolean;
}

interface ChannelLink {
  title?: string;
  url?: string;
}
```

## Errors

Errors are exported classes with a literal `_tag`. They do not share a runtime
base class; `JustYtError` is their TypeScript union, and `YouTubeError` is the
high-level operation error union.

| Class / `_tag` | Important fields | Meaning |
| --- | --- | --- |
| `NetworkError` | `message`, `url`, `cause?` | The request did not reach YouTube or its response could not be read. |
| `SessionError` | `message`, `cause?` | The anonymous Innertube session could not be established. |
| `InnertubeError` | `message`, `endpoint`, `status`, `body?` | YouTube returned a non-2xx response. |
| `ExtractionError` | `message`, `path`, `received?` | The response shape did not match the parser. |
| `NotFoundError` | `message`, `kind`, `id` | A video, channel, playlist, or transcript could not be found. |
| `UnavailableError` | `message`, `videoId`, `status`, `reason?` | A known video is not playable by the anonymous client. |

```ts
import { NotFoundError, UnavailableError } from 'just-yt';

try {
  await youtube.video(id);
} catch (error) {
  if (error instanceof NotFoundError) return undefined;
  if (error instanceof UnavailableError) {
    console.warn(error.status, error.reason);
    return undefined;
  }
  throw error;
}
```

## Effect API and provider

`YouTubeApi` is an Effect context tag with the same operations. It also adds
`searchStream`, which returns `Stream.Stream<SearchResult, YouTubeError>`.

```ts
import { Effect } from 'effect';
import { YouTubeApi, layer } from 'just-yt';

const program = Effect.gen(function* () {
  const youtube = yield* YouTubeApi;
  return yield* youtube.channel('@veritasium');
});

await Effect.runPromise(program.pipe(Effect.provide(layer())));
```

`layer(options?)` provides the complete `YouTubeStack`: `Config`, `Session`,
`Innertube`, and `YouTubeApi`. Build and share the layer instead of recreating it
for each request.

## Lower-level exports

| Export | Purpose |
| --- | --- |
| `Config`, `Config.layer`, `resolveConfig` | Resolve options into runtime configuration. |
| `Session`, `SessionLive`, `makeSession` | Create and access anonymous session state. |
| `Innertube`, `InnertubeLive` | Execute a raw Innertube endpoint. |
| `CLIENTS`, `CLIENT_TYPES`, `CLIENT_NAME_IDS` | Predefined YouTube request profiles and identifiers. |
| `URLS` | YouTube service URLs used internally. |
| `parseVideoId`, `parseChannelTarget` | Parse accepted IDs and URLs. |

Raw Innertube data is intentionally `unknown` and unstable. Prefer the
high-level models whenever the SDK wraps the endpoint.
