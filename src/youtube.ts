import { Chunk, Context, Effect, Layer, Option, Stream } from "effect";
import { Config, type ClientOptions } from "./config.js";
import type {
  ChannelDetails,
  SearchPage,
  SearchResult,
  Transcript,
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
import { extractSearchPage, extractSuggestions } from "./internal/extract/search.js";
import {
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
}

export interface YouTubeService {
  /** Runs a search and returns one page of results. */
  readonly search: (
    query: string,
    options?: SearchOptions,
  ) => Effect.Effect<SearchPage, YouTubeError>;

  /**
   * Streams search results across pages, following continuations until the
   * feed is exhausted or the stream is interrupted.
   */
  readonly searchStream: (
    query: string,
    options?: SearchOptions,
  ) => Stream.Stream<SearchResult, YouTubeError>;

  /** Autocomplete suggestions for a partial query. */
  readonly searchSuggestions: (
    query: string,
  ) => Effect.Effect<ReadonlyArray<string>, YouTubeError>;

  /** Full metadata for a video id or any YouTube video URL. */
  readonly getVideo: (
    target: string,
    options?: VideoOptions,
  ) => Effect.Effect<VideoDetails, YouTubeError>;

  /** Timed transcript for a video, when one is published. */
  readonly getTranscript: (
    target: string,
    options?: TranscriptOptions,
  ) => Effect.Effect<Transcript, YouTubeError>;

  /** Channel metadata for a channel id, `@handle`, or channel URL. */
  readonly getChannel: (
    target: string,
  ) => Effect.Effect<ChannelDetails, YouTubeError>;
}

export class YouTube extends Context.Tag("just-yt/YouTube")<
  YouTube,
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

  const search: YouTubeService["search"] = (query, options = {}) =>
    Effect.gen(function* () {
      if (query.trim().length === 0 && options.continuation === undefined) {
        return { results: [], continuation: undefined };
      }

      const payload =
        options.continuation !== undefined
          ? { continuation: options.continuation }
          : { query, params: encodeSearchFilters(options) };

      const response = yield* innertube.execute("/search", payload);
      return extractSearchPage(response);
    });

  const searchStream: YouTubeService["searchStream"] = (query, options = {}) =>
    Stream.paginateChunkEffect(
      options.continuation,
      (continuation: string | undefined) =>
        search(query, { ...options, continuation }).pipe(
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

  const searchSuggestions: YouTubeService["searchSuggestions"] = (query) =>
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

  const getVideo: YouTubeService["getVideo"] = (target, options = {}) =>
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

  const getTranscript: YouTubeService["getTranscript"] = (
    target,
    options = {},
  ) =>
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

      return {
        videoId,
        languageCode: requested.languageCode,
        language: requested.name,
        isAutoGenerated: requested.isAutoGenerated,
        availableLanguages: tracks.map(
          ({ baseUrl: _baseUrl, ...track }) => track,
        ),
        segments,
        // Segments keep YouTube's line breaks; the joined text does not, since
        // those are a caption-rendering detail rather than content.
        text: segments
          .map((segment) => segment.text)
          .join(" ")
          .replace(/\s+/g, " ")
          .trim(),
      } satisfies Transcript;
    });

  const getChannel: YouTubeService["getChannel"] = (target) =>
    Effect.gen(function* () {
      const parsed = parseChannelTarget(target);

      const browseId =
        parsed._tag === "browseId"
          ? parsed.browseId
          : yield* Effect.gen(function* () {
              const resolved = yield* innertube.execute(
                "/navigation/resolve_url",
                { url: parsed.url },
              );

              const id = getString(
                findFirst(resolved, "browseEndpoint"),
                "browseId",
              );

              if (id === undefined) {
                return yield* new NotFoundError({
                  message: `Could not resolve "${target}" to a channel`,
                  kind: "channel",
                  id: target,
                });
              }

              return id;
            });

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

  // Touching the session here surfaces creation failures when the layer is
  // built, rather than on the first call.
  yield* Effect.logDebug(
    `just-yt: session ready for ${session.context.client.clientName} ${session.context.client.clientVersion}`,
  );

  return {
    search,
    searchStream,
    searchSuggestions,
    getVideo,
    getTranscript,
    getChannel,
  } satisfies YouTubeService;
});

export const YouTubeLive: Layer.Layer<YouTube, never, Config | Innertube | Session> =
  Layer.effect(YouTube, makeYouTube);

/** Everything {@link layer} provides. */
export type YouTubeStack = YouTube | Innertube | Session | Config;

/**
 * The complete stack: config, session, transport, and the high-level API.
 *
 * Session creation happens once when the layer is built, so share a single
 * instance across calls rather than rebuilding it per request. The lower layers
 * are merged into the output too, so `Innertube` is available for endpoints
 * this library does not wrap.
 */
export const layer = (
  options: ClientOptions = {},
): Layer.Layer<
  YouTubeStack,
  SessionError | NetworkError | InnertubeError
> => {
  const config = Config.layer(options);
  const session = SessionLive.pipe(Layer.provideMerge(config));
  const innertube = InnertubeLive.pipe(Layer.provideMerge(session));

  return YouTubeLive.pipe(Layer.provideMerge(innertube));
};
