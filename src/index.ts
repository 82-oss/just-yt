/**
 * just-yt — a typed SDK for extracting public data from YouTube.
 *
 * ```ts
 * import { YouTube } from "just-yt";
 *
 * const yt = new YouTube();
 *
 * const video = await yt.video("https://www.youtube.com/watch?v=jNQXAC9IVRw");
 * const results = await yt.search("effect ts", { type: "video", limit: 50 });
 * const lines = await yt.transcript("dQw4w9WgXcQ");
 * const channel = await yt.channel("@veritasium");
 * ```
 *
 * The same functionality is available as an Effect service:
 *
 * ```ts
 * import { Effect } from "effect";
 * import { YouTubeApi, layer } from "just-yt";
 *
 * const program = Effect.gen(function* () {
 *   const yt = yield* YouTubeApi;
 *   return yield* yt.video("dQw4w9WgXcQ");
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(layer())));
 * ```
 */

export { YouTube } from "./youtube.js";

export {
  Config,
  resolveConfig,
  type FetchFn,
  type ResolvedConfig,
  type YouTubeOptions,
} from "./config.js";

export {
  YouTubeApi,
  YouTubeApiLive,
  layer,
  type BatchOptions,
  type BatchResult,
  type ChannelSeed,
  type ChannelsOptions,
  type QuerySeed,
  type RecommendedOptions,
  type SearchFilters,
  type SearchOptions,
  type SegmentedTranscriptOptions,
  type SegmentedTranscriptsOptions,
  type TranscriptOptions,
  type TranscriptsOptions,
  type VideoOptions,
  type VideoSeed,
  type VideosOptions,
  type YouTubeError,
  type YouTubeService,
  type YouTubeStack,
} from "./api.js";

export type {
  AuthorRef,
  CaptionTrack,
  ChannelDetails,
  ChannelLink,
  ChannelSearchResult,
  FeedItem,
  FeedItemSource,
  PlaylistSearchResult,
  RecommendedFeed,
  SearchPage,
  SearchResult,
  SegmentedTranscript,
  SkippedSeed,
  Thumbnail,
  Transcript,
  TranscriptSegment,
  VideoDetails,
  VideoSearchResult,
} from "./domain.js";

export {
  ExtractionError,
  InnertubeError,
  NetworkError,
  NotFoundError,
  SessionError,
  UnavailableError,
  type JustYtError,
} from "./errors.js";

// Lower-level pieces, for callers who need to drive Innertube directly.
export {
  Innertube,
  InnertubeLive,
  type Endpoint,
  type ExecuteOptions,
  type InnertubeService,
} from "./internal/actions.js";

export {
  Session,
  SessionLive,
  makeSession,
  type SessionState,
} from "./internal/session.js";

export {
  CLIENTS,
  CLIENT_NAME_IDS,
  CLIENT_TYPES,
  URLS,
  type ClientType,
} from "./internal/constants.js";

export type { InnertubeContext } from "./internal/context.js";

export { parseChannelTarget, parseVideoId } from "./internal/ids.js";

export type {
  Duration as SearchDuration,
  SearchFeature,
  SearchType,
  SortBy as SearchSortBy,
  UploadDate as SearchUploadDate,
} from "./internal/params.js";
