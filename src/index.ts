/**
 * just-yt — a typed SDK for extracting public data from YouTube.
 *
 * Two ways in:
 *
 * ```ts
 * // Promise API
 * import { createClient } from "just-yt";
 * const yt = await createClient();
 * const video = await yt.getVideo("dQw4w9WgXcQ");
 * ```
 *
 * ```ts
 * // Effect API
 * import { Effect } from "effect";
 * import { YouTube, layer } from "just-yt";
 *
 * const program = Effect.gen(function* () {
 *   const yt = yield* YouTube;
 *   return yield* yt.getVideo("dQw4w9WgXcQ");
 * });
 *
 * Effect.runPromise(program.pipe(Effect.provide(layer())));
 * ```
 */

export { Client, createClient, type SearchAllOptions } from "./client.js";

export {
  Config,
  resolveConfig,
  type ClientOptions,
  type FetchFn,
  type ResolvedConfig,
} from "./config.js";

export {
  YouTube,
  YouTubeLive,
  layer,
  type SearchFilters,
  type SearchOptions,
  type TranscriptOptions,
  type VideoOptions,
  type YouTubeError,
  type YouTubeService,
  type YouTubeStack,
} from "./youtube.js";

export type {
  AuthorRef,
  CaptionTrack,
  ChannelDetails,
  ChannelLink,
  ChannelSearchResult,
  PlaylistSearchResult,
  SearchPage,
  SearchResult,
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
