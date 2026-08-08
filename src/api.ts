import { Chunk, Context, Effect, Layer, Option, Stream } from "effect";
import { Config, type YouTubeOptions } from "./config.js";
import type {
  ChannelDetails,
  FeedItemSource,
  RecommendedFeed,
  SearchPage,
  SearchResult,
  SegmentedTranscript,
  SkippedSeed,
  Transcript,
  TranscriptSegment,
  VideoDetails,
} from "./domain.js";
import {
  ExtractionError,
  InnertubeError,
  NetworkError,
  NotFoundError,
  SessionError,
  UnavailableError,
} from "./errors.js";
import { Innertube, InnertubeLive, navigateActionBrowseId } from "./internal/actions.js";
import { URLS, type ClientType } from "./internal/constants.js";
import {
  aboutContinuationTokens,
  extractChannelDetails,
} from "./internal/extract/channel.js";
import {
  feedItemsFromLockups,
  feedItemsFromPanel,
  feedItemsFromSearch,
  type RawFeedItem,
} from "./internal/extract/feed.js";
import { extractSearchPage, extractSuggestions } from "./internal/extract/search.js";
import { assembleFeed, type Candidate } from "./internal/recommend.js";
import {
  cleanTranscriptText,
  parseTimedText,
  timedTextUrl,
} from "./internal/extract/transcript.js";
import {
  captionTracksOf,
  extractVideoDetails,
  isRetryablePlayability,
  playabilityReason,
  playabilityStatus,
} from "./internal/extract/video.js";
import { requestText } from "./internal/http.js";
import { parseChannelTarget, parseVideoId } from "./internal/ids.js";
import { findFirst, getString } from "./internal/json.js";
import { encodeSearchFilters, type SearchFilters } from "./internal/params.js";
import { Session, SessionLive } from "./internal/session.js";

export type { SearchFilters } from "./internal/params.js";

export type YouTubeError =
  | NetworkError
  | InnertubeError
  | ExtractionError
  | NotFoundError
  | UnavailableError;

export interface SearchOptions extends SearchFilters {
  /**
   * Collect up to this many results, following continuations as needed.
   * Omit it to get exactly one page.
   */
  readonly limit?: number;
  /** Continue a previous page instead of starting a new search. */
  readonly continuation?: string;
}

export interface VideoOptions {
  /**
   * Skip the `/next` call. Faster, but drops like count, comment count,
   * subscriber count, and the channel avatar.
   */
  readonly basic?: boolean;
  /** Force a specific client instead of the built-in fallback chain. */
  readonly client?: ClientType;
}

export interface TranscriptOptions {
  /**
   * Caption track to read, as either a language code (`"en"`) or the track name
   * YouTube lists (`"English (auto-generated)"`). Defaults to the first
   * human-written track, falling back to the auto-generated one.
   */
  readonly language?: string;
  /** Force a specific client instead of the built-in fallback chain. */
  readonly client?: ClientType;
  /** Return timestamped segments instead of one complete string. */
  readonly segmented?: false;
}

export interface SegmentedTranscriptOptions
  extends Omit<TranscriptOptions, "segmented"> {
  readonly segmented: true;
}

type AnyTranscriptOptions = TranscriptOptions | SegmentedTranscriptOptions;

export interface BatchOptions {
  /**
   * Maximum number of targets processed at once. Defaults to `2` and is capped
   * at `4` so bulk lookups do not create an unbounded request burst.
   */
  readonly concurrency?: 1 | 2 | 3 | 4;
}

/** A video id or URL, optionally weighted. */
export type VideoSeed =
  | string
  | { readonly video: string; readonly weight?: number };

/** A search query, optionally weighted. */
export type QuerySeed =
  | string
  | { readonly query: string; readonly weight?: number };

/** A channel id, `@handle`, or URL, optionally weighted. */
export type ChannelSeed =
  | string
  | { readonly channel: string; readonly weight?: number };

export interface RecommendedOptions extends BatchOptions {
  /** Videos to find more like. Each contributes its sidebar and its mix. */
  readonly videos?: ReadonlyArray<VideoSeed>;
  /** Topics to search for. */
  readonly queries?: ReadonlyArray<QuerySeed>;
  /** Channels to pull recent uploads from. */
  readonly channels?: ReadonlyArray<ChannelSeed>;
  /** How many items to return. Defaults to `50`. */
  readonly limit?: number;
  /**
   * How many items one channel may contribute, so a prolific uploader cannot
   * crowd out the rest of the feed. Defaults to `3`.
   */
  readonly maxPerChannel?: number;
}

export interface VideosOptions extends VideoOptions, BatchOptions {}

export interface TranscriptsOptions extends TranscriptOptions, BatchOptions {}

export interface SegmentedTranscriptsOptions
  extends SegmentedTranscriptOptions,
    BatchOptions {}

export interface ChannelsOptions extends BatchOptions {}

/** The outcome of one target in a bulk lookup. */
export type BatchResult<A> =
  | {
      readonly ok: true;
      readonly target: string;
      readonly value: A;
    }
  | {
      readonly ok: false;
      readonly target: string;
      readonly error: YouTubeError;
    };

export interface TranscriptLookup {
  (
    target: string,
    options: SegmentedTranscriptOptions,
  ): Effect.Effect<SegmentedTranscript, YouTubeError>;
  (
    target: string,
    options?: TranscriptOptions,
  ): Effect.Effect<Transcript, YouTubeError>;
}

export interface TranscriptsLookup {
  (
    targets: ReadonlyArray<string>,
    options: SegmentedTranscriptsOptions,
  ): Effect.Effect<ReadonlyArray<BatchResult<SegmentedTranscript>>>;
  (
    targets: ReadonlyArray<string>,
    options?: TranscriptsOptions,
  ): Effect.Effect<ReadonlyArray<BatchResult<Transcript>>>;
}

export interface YouTubeService {
  /**
   * Runs a search. Returns one page unless `limit` asks for more, in which case
   * continuations are followed until the limit is met or the feed runs out.
   */
  readonly search: (
    query: string,
    options?: SearchOptions,
  ) => Effect.Effect<SearchPage, YouTubeError>;

  /**
   * Search results as a stream, following continuations until the feed is
   * exhausted or the stream is interrupted. The one two-word name here, because
   * it returns something other than an `Effect`.
   */
  readonly searchStream: (
    query: string,
    options?: SearchOptions,
  ) => Stream.Stream<SearchResult, YouTubeError>;

  /** Autocomplete suggestions for a partial query. */
  readonly suggestions: (
    query: string,
  ) => Effect.Effect<ReadonlyArray<string>, YouTubeError>;

  /** Full metadata for a video id or any YouTube video URL. */
  readonly video: (
    target: string,
    options?: VideoOptions,
  ) => Effect.Effect<VideoDetails, YouTubeError>;

  /** Full metadata for many videos, with failures captured per target. */
  readonly videos: (
    targets: ReadonlyArray<string>,
    options?: VideosOptions,
  ) => Effect.Effect<ReadonlyArray<BatchResult<VideoDetails>>>;

  /** Timed transcript for a video, when one is published. */
  readonly transcript: TranscriptLookup;

  /** Timed transcripts for many videos, with failures captured per target. */
  readonly transcripts: TranscriptsLookup;

  /**
   * Builds a home-page-style feed from seeds you supply.
   *
   * YouTube has no logged-out home feed to read — `FEwhat_to_watch` answers an
   * anonymous session with a "start watching to build your feed" placeholder —
   * so the feed is assembled here: each seed is expanded against YouTube, and
   * the candidates are merged, scored, and capped per channel.
   *
   * A seed that fails is reported in `skipped` rather than failing the feed.
   */
  readonly recommended: (
    options?: RecommendedOptions,
  ) => Effect.Effect<RecommendedFeed, YouTubeError>;

  /** Channel metadata for a channel id, `@handle`, or channel URL. */
  readonly channel: (
    target: string,
  ) => Effect.Effect<ChannelDetails, YouTubeError>;

  /** Metadata for many channels, with failures captured per target. */
  readonly channels: (
    targets: ReadonlyArray<string>,
    options?: ChannelsOptions,
  ) => Effect.Effect<ReadonlyArray<BatchResult<ChannelDetails>>>;
}

/**
 * The Effect-native API.
 *
 * Named `YouTubeApi` so the `YouTube` name belongs to the Promise class, which
 * is what most callers reach for.
 */
export class YouTubeApi extends Context.Tag("just-yt/YouTubeApi")<
  YouTubeApi,
  YouTubeService
>() {}

/**
 * Clients tried in order when `/player` refuses the default.
 *
 * A refusal is usually about which identity asked, not about the video: the
 * embedded TV client in particular still answers for many videos the web client
 * will not serve anonymously.
 */
const PLAYER_FALLBACKS: ReadonlyArray<ClientType> = [
  "IOS",
  "ANDROID_VR",
  "TV_EMBEDDED",
];

const makeYouTube = Effect.gen(function* () {
  const config = yield* Config;
  const innertube = yield* Innertube;
  const session = yield* Session;

  /** One page of results, either a fresh query or a continuation. */
  const searchPage = (
    query: string,
    options: SearchOptions,
    continuation: string | undefined,
  ): Effect.Effect<SearchPage, YouTubeError> =>
    Effect.gen(function* () {
      if (query.trim().length === 0 && continuation === undefined) {
        return { results: [], continuation: undefined };
      }

      const payload =
        continuation !== undefined
          ? { continuation }
          : { query, params: encodeSearchFilters(options) };

      const response = yield* innertube.execute("/search", payload);
      return extractSearchPage(response);
    });

  const search: YouTubeService["search"] = (query, options = {}) =>
    Effect.gen(function* () {
      const first = yield* searchPage(query, options, options.continuation);

      const limit = options.limit;
      if (limit === undefined || first.results.length >= limit) {
        return limit === undefined
          ? first
          : { ...first, results: first.results.slice(0, limit) };
      }

      const results = [...first.results];
      let page = first;

      while (results.length < limit && page.continuation !== undefined) {
        page = yield* searchPage(query, options, page.continuation);

        // A page with a token but no items means the feed is spent.
        if (page.results.length === 0) break;

        results.push(...page.results);
      }

      return {
        results: results.slice(0, limit),
        estimatedResults: first.estimatedResults,
        continuation: page.continuation,
      };
    });

  const searchStream: YouTubeService["searchStream"] = (query, options = {}) =>
    Stream.paginateChunkEffect(
      options.continuation,
      (continuation: string | undefined) =>
        searchPage(query, options, continuation).pipe(
          Effect.map((page) => {
            // An empty page with a token loops forever; stop on either signal.
            const next =
              page.continuation !== undefined && page.results.length > 0
                ? Option.some(page.continuation)
                : Option.none<string>();

            return [Chunk.fromIterable(page.results), next] as const;
          }),
        ),
    );

  const suggestions: YouTubeService["suggestions"] = (query) =>
    Effect.gen(function* () {
      const url = new URL(`${URLS.YT_SUGGESTIONS}/complete/search`);
      url.searchParams.set("client", "youtube");
      url.searchParams.set("gs_ri", "youtube");
      url.searchParams.set("ds", "yt");
      url.searchParams.set("hl", config.lang);
      url.searchParams.set("gl", config.location);
      url.searchParams.set("q", query);

      const payload = yield* requestText({
        url,
        label: "/complete/search",
        headers: { "User-Agent": config.userAgent },
      }).pipe(Effect.provideService(Config, config));

      return extractSuggestions(payload);
    });

  /**
   * Calls `/player`, walking the fallback clients while playability is refused.
   *
   * Every response is kept, not just the winning one: a client that refuses
   * playback still returns metadata the playable client omits, and the
   * extractor merges across them. The playable response is returned first so it
   * decides playability status.
   */
  const fetchPlayer = (videoId: string, client: ClientType | undefined) =>
    Effect.gen(function* () {
      const payload = { videoId, contentCheckOk: true, racyCheckOk: true };

      const candidates: ReadonlyArray<ClientType> =
        client !== undefined ? [client] : [config.client, ...PLAYER_FALLBACKS];

      const attempts: unknown[] = [];

      for (const candidate of candidates) {
        const response = yield* innertube.execute("/player", payload, {
          client: candidate,
          withPoToken: true,
        });

        attempts.push(response);

        if (!isRetryablePlayability(response)) {
          return [
            response,
            ...attempts.filter((attempt) => attempt !== response),
          ] as ReadonlyArray<unknown>;
        }
      }

      return attempts as ReadonlyArray<unknown>;
    });

  const video: YouTubeService["video"] = (target, options = {}) =>
    Effect.gen(function* () {
      const videoId = parseVideoId(target);

      if (videoId === undefined) {
        return yield* new NotFoundError({
          message: `Could not read a video id from "${target}"`,
          kind: "video",
          id: target,
        });
      }

      const players = yield* fetchPlayer(videoId, options.client);
      const status = playabilityStatus(players[0]);

      if (status === "ERROR" || status === "LOGIN_REQUIRED") {
        const reason = playabilityReason(players[0]);
        return yield* new UnavailableError({
          message: `Video ${videoId} is not available: ${reason ?? status}`,
          videoId,
          status,
          reason,
        });
      }

      const next =
        options.basic === true
          ? undefined
          : yield* innertube
              .execute("/next", { videoId }, { client: "WEB" })
              // The watch page is enrichment; losing it should not lose the video.
              .pipe(Effect.catchAll(() => Effect.succeed(undefined)));

      return yield* extractVideoDetails(players, next);
    });

  const transcript = ((target: string, options: AnyTranscriptOptions = {}) =>
    Effect.gen(function* () {
      const videoId = parseVideoId(target);

      if (videoId === undefined) {
        return yield* new NotFoundError({
          message: `Could not read a video id from "${target}"`,
          kind: "video",
          id: target,
        });
      }

      const players = yield* fetchPlayer(videoId, options.client);
      const status = playabilityStatus(players[0]);
      const title = players
        .map((player) => getString(findFirst(player, "videoDetails"), "title"))
        .find((value) => value !== undefined);

      if (title === undefined) {
        if (status !== "OK" && status !== "UNKNOWN") {
          const reason = playabilityReason(players[0]);
          return yield* new UnavailableError({
            message: `Video ${videoId} is not available: ${reason ?? status}`,
            videoId,
            status,
            reason,
          });
        }

        return yield* new ExtractionError({
          message: `Player response for ${videoId} contained no video title`,
          path: "videoDetails.title",
          received: players[0],
        });
      }

      const tracks = captionTracksOf(players);

      if (tracks.length === 0) {
        return yield* new NotFoundError({
          message: `Video ${videoId} has no captions to build a transcript from`,
          kind: "transcript",
          id: videoId,
        });
      }

      const requested =
        options.language === undefined
          ? // Prefer a human-written track; fall back to the auto-generated one.
            tracks.find((track) => !track.isAutoGenerated) ?? tracks[0]
          : tracks.find(
              (track) =>
                track.languageCode === options.language ||
                track.name === options.language,
            );

      if (requested === undefined) {
        return yield* new NotFoundError({
          message: `No caption track matches "${options.language}" for ${videoId}. Available: ${tracks
            .map((track) => `${track.languageCode} (${track.name ?? "?"})`)
            .join(", ")}`,
          kind: "transcript",
          id: videoId,
        });
      }

      const payload = yield* requestText({
        url: timedTextUrl(requested.baseUrl),
        label: "/api/timedtext",
        headers: { "User-Agent": config.userAgent },
      }).pipe(Effect.provideService(Config, config));

      const segments = parseTimedText(payload);

      if (segments.length === 0) {
        return yield* new ExtractionError({
          message: `Timed-text response for ${videoId} contained no segments`,
          path: "events",
          received: payload.slice(0, 200),
        });
      }

      const data = segments
        .map((segment): TranscriptSegment | undefined => {
          const text = cleanTranscriptText(segment.text);
          return text.length === 0
            ? undefined
            : {
                start: segment.startMs / 1_000,
                end: segment.endMs / 1_000,
                text,
              };
        })
        .filter((segment): segment is TranscriptSegment => segment !== undefined);

      return options.segmented === true
        ? { title, data }
        : { title, data: data.map((segment) => segment.text).join(" ") };
    })) as TranscriptLookup;

  /**
   * Results one seed may contribute before the merge.
   *
   * A channel's uploads playlist answers with a hundred videos at once; left
   * uncapped a single channel seed would dominate the candidate pool no matter
   * what the per-channel cap does later.
   */
  const PER_SEED_LIMIT = 25;

  interface NormalizedSeed {
    readonly value: string;
    readonly weight: number;
    readonly kind: FeedItemSource["kind"];
  }

  /** Accepts both the bare-string shorthand and the weighted object form. */
  const normalizeSeeds = (
    seeds: ReadonlyArray<unknown> | undefined,
    key: "video" | "query" | "channel",
  ): ReadonlyArray<NormalizedSeed> =>
    (seeds ?? []).flatMap((seed) => {
      const value =
        typeof seed === "string"
          ? seed
          : typeof (seed as Record<string, unknown>)?.[key] === "string"
            ? ((seed as Record<string, string>)[key] as string)
            : undefined;

      if (value === undefined || value.trim().length === 0) return [];

      const rawWeight =
        typeof seed === "object" && seed !== null
          ? (seed as { weight?: unknown }).weight
          : undefined;

      // A negative or non-finite weight would invert or poison the ranking.
      const weight =
        typeof rawWeight === "number" && Number.isFinite(rawWeight) && rawWeight >= 0
          ? rawWeight
          : 1;

      return [{ value, weight, kind: key } satisfies NormalizedSeed];
    });

  const toCandidates = (
    items: ReadonlyArray<RawFeedItem>,
    seed: NormalizedSeed,
    via: FeedItemSource["via"],
  ): ReadonlyArray<Candidate> =>
    items.slice(0, PER_SEED_LIMIT).map((item, rank) => ({
      item,
      rank,
      seedWeight: seed.weight,
      source: { seed: seed.value, kind: seed.kind, via },
    }));

  /**
   * Runs one seed, turning an expected failure into a skip.
   *
   * A dead video id or an unreachable channel costs that seed's contribution
   * and nothing else — the feed is an aggregate, so it degrades rather than
   * failing outright.
   */
  const runSeed = (
    seed: NormalizedSeed,
    produce: Effect.Effect<ReadonlyArray<Candidate>, YouTubeError>,
  ): Effect.Effect<{
    readonly candidates: ReadonlyArray<Candidate>;
    readonly skipped?: SkippedSeed;
  }> =>
    produce.pipe(
      Effect.match({
        onSuccess: (candidates) =>
          candidates.length > 0
            ? { candidates }
            : {
                candidates: [],
                skipped: {
                  seed: seed.value,
                  kind: seed.kind,
                  reason: "No results",
                },
              },
        onFailure: (error) => ({
          candidates: [] as ReadonlyArray<Candidate>,
          skipped: {
            seed: seed.value,
            kind: seed.kind,
            reason: `${error._tag}: ${error.message}`,
          },
        }),
      }),
    );

  /**
   * A video seed contributes two independent lists.
   *
   * The sidebar and the video's `RDMM` radio queue overlap surprisingly little,
   * so taking both widens coverage instead of reinforcing the same picks. The
   * mix is the stronger signal but is not always populated, and the sidebar is
   * always there, so a failure in either still leaves the other.
   */
  const videoCandidates = (
    seed: NormalizedSeed,
  ): Effect.Effect<ReadonlyArray<Candidate>, YouTubeError> =>
    Effect.gen(function* () {
      const videoId = parseVideoId(seed.value);

      if (videoId === undefined) {
        return yield* new NotFoundError({
          message: `Could not read a video id from "${seed.value}"`,
          kind: "video",
          id: seed.value,
        });
      }

      const optional = <A>(effect: Effect.Effect<A, YouTubeError>) =>
        effect.pipe(Effect.catchAll(() => Effect.succeed(undefined)));

      const [related, mix] = yield* Effect.all(
        [
          optional(innertube.execute("/next", { videoId }, { client: "WEB" })),
          optional(
            innertube.execute(
              "/next",
              // `RD` alone only builds a queue for music; `RDMM` works generally.
              { videoId, playlistId: `RDMM${videoId}` },
              { client: "WEB" },
            ),
          ),
        ],
        { concurrency: 2 },
      );

      // The mix always opens with the seed itself; it is not a recommendation.
      const mixItems = feedItemsFromPanel(mix).filter(
        (item) => item.id !== videoId,
      );

      return [
        ...toCandidates(feedItemsFromLockups(related), seed, "related"),
        ...toCandidates(mixItems, seed, "mix"),
      ];
    });

  const queryCandidates = (
    seed: NormalizedSeed,
  ): Effect.Effect<ReadonlyArray<Candidate>, YouTubeError> =>
    searchPage(seed.value, { type: "video" }, undefined).pipe(
      Effect.map((page) =>
        toCandidates(feedItemsFromSearch(page.results), seed, "search"),
      ),
    );

  const channelCandidates = (
    seed: NormalizedSeed,
  ): Effect.Effect<ReadonlyArray<Candidate>, YouTubeError> =>
    Effect.gen(function* () {
      const browseId = yield* resolveChannelBrowseId(seed.value);

      // Every channel's uploads live in a playlist whose id is its own with
      // the `UC` prefix swapped for `UU`, newest first.
      const uploads = `VLUU${browseId.slice(2)}`;
      const response = yield* innertube.execute("/browse", {
        browseId: uploads,
      });

      return toCandidates(feedItemsFromLockups(response), seed, "uploads");
    });

  const recommended: YouTubeService["recommended"] = (options = {}) =>
    Effect.gen(function* () {
      const videoSeeds = normalizeSeeds(options.videos, "video");
      const querySeeds = normalizeSeeds(options.queries, "query");
      const channelSeeds = normalizeSeeds(options.channels, "channel");

      const tasks = [
        ...videoSeeds.map((seed) => runSeed(seed, videoCandidates(seed))),
        ...querySeeds.map((seed) => runSeed(seed, queryCandidates(seed))),
        ...channelSeeds.map((seed) => runSeed(seed, channelCandidates(seed))),
      ];

      if (tasks.length === 0) return { items: [], skipped: [] };

      const outcomes = yield* Effect.all(tasks, {
        concurrency: Math.max(1, Math.min(options.concurrency ?? 2, 4)),
      });

      // A seed video is the question, never part of the answer.
      const exclude = new Set(
        videoSeeds
          .map((seed) => parseVideoId(seed.value))
          .filter((id): id is string => id !== undefined),
      );

      return {
        items: assembleFeed(
          outcomes.flatMap((outcome) => outcome.candidates),
          {
            limit: Math.max(1, options.limit ?? 50),
            maxPerChannel: Math.max(1, options.maxPerChannel ?? 3),
            exclude,
          },
        ),
        skipped: outcomes.flatMap((outcome) =>
          outcome.skipped === undefined ? [] : [outcome.skipped],
        ),
      };
    });

  /** Resolves a channel id, `@handle`, or URL to its canonical `UC…` id. */
  const resolveChannelBrowseId = (
    target: string,
  ): Effect.Effect<string, YouTubeError> =>
    Effect.gen(function* () {
      const parsed = parseChannelTarget(target);
      if (parsed._tag === "browseId") return parsed.browseId;

      const resolved = yield* innertube.execute("/navigation/resolve_url", {
        url: parsed.url,
      });

      const id = getString(findFirst(resolved, "browseEndpoint"), "browseId");

      if (id === undefined) {
        return yield* new NotFoundError({
          message: `Could not resolve "${target}" to a channel`,
          kind: "channel",
          id: target,
        });
      }

      return id;
    });

  const channel: YouTubeService["channel"] = (target) =>
    Effect.gen(function* () {
      const browseId = yield* resolveChannelBrowseId(target);

      const browse = yield* innertube.execute("/browse", { browseId });

      // A browse can answer with a redirect rather than content.
      const redirect = navigateActionBrowseId(browse);
      const response =
        redirect?.browseId !== undefined
          ? yield* innertube.execute("/browse", {
              browseId: redirect.browseId,
              params: redirect.params,
            })
          : browse;

      // The About panel holds the view count, join date, country, and links.
      // It is usually a continuation away; a failure there costs those fields,
      // not the channel.
      const about = yield* Effect.gen(function* () {
        const inline = findFirst(response, "aboutChannelViewModel");
        if (inline !== undefined) return inline;

        for (const token of aboutContinuationTokens(response).slice(0, 2)) {
          const continuation = yield* innertube.execute("/browse", {
            continuation: token,
          });

          const view = findFirst(continuation, "aboutChannelViewModel");
          if (view !== undefined) return view;
        }

        return undefined;
      }).pipe(Effect.catchAll(() => Effect.succeed(undefined)));

      return yield* extractChannelDetails(response, about);
    });

  const runBatch = <A>(
    targets: ReadonlyArray<string>,
    concurrency: BatchOptions["concurrency"],
    operation: (target: string) => Effect.Effect<A, YouTubeError>,
  ): Effect.Effect<ReadonlyArray<BatchResult<A>>> =>
    Effect.forEach(
      targets,
      (target) =>
        operation(target).pipe(
          Effect.match({
            onSuccess: (value): BatchResult<A> => ({
              ok: true,
              target,
              value,
            }),
            onFailure: (error): BatchResult<A> => ({
              ok: false,
              target,
              error,
            }),
          }),
        ),
      { concurrency: Math.max(1, Math.min(concurrency ?? 2, 4)) },
    );

  const videos: YouTubeService["videos"] = (targets, options = {}) => {
    const { concurrency, ...videoOptions } = options;
    return runBatch(targets, concurrency, (target) =>
      video(target, videoOptions),
    );
  };

  const transcripts = ((
    targets: ReadonlyArray<string>,
    options: (TranscriptsOptions | SegmentedTranscriptsOptions) = {},
  ) => {
    const { concurrency, ...transcriptOptions } = options;
    return runBatch(targets, concurrency, (target) =>
      transcript(target, transcriptOptions as TranscriptOptions),
    );
  }) as TranscriptsLookup;

  const channels: YouTubeService["channels"] = (targets, options = {}) =>
    runBatch(targets, options.concurrency, channel);

  // Touching the session here surfaces creation failures when the layer is
  // built, rather than on the first call.
  yield* Effect.logDebug(
    `just-yt: session ready for ${session.context.client.clientName} ${session.context.client.clientVersion}`,
  );

  return {
    search,
    searchStream,
    suggestions,
    video,
    videos,
    transcript,
    transcripts,
    recommended,
    channel,
    channels,
  } satisfies YouTubeService;
});

export const YouTubeApiLive: Layer.Layer<
  YouTubeApi,
  never,
  Config | Innertube | Session
> = Layer.effect(YouTubeApi, makeYouTube);

/** Everything {@link layer} provides. */
export type YouTubeStack = YouTubeApi | Innertube | Session | Config;

/**
 * The complete stack: config, session, transport, and the high-level API.
 *
 * Session creation happens once when the layer is built, so share a single
 * instance across calls rather than rebuilding it per request. The lower layers
 * are merged into the output too, so `Innertube` is available for endpoints
 * this library does not wrap.
 */
export const layer = (
  options: YouTubeOptions = {},
): Layer.Layer<
  YouTubeStack,
  SessionError | NetworkError | InnertubeError
> => {
  const config = Config.layer(options);
  const session = SessionLive.pipe(Layer.provideMerge(config));
  const innertube = InnertubeLive.pipe(Layer.provideMerge(session));

  return YouTubeApiLive.pipe(Layer.provideMerge(innertube));
};
