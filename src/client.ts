import { Cause, Effect, Exit, ManagedRuntime, Option, Stream } from "effect";
import type { ClientOptions } from "./config.js";
import type {
  ChannelDetails,
  SearchPage,
  SearchResult,
  Transcript,
  VideoDetails,
} from "./domain.js";
import type { InnertubeError, NetworkError, SessionError } from "./errors.js";
import {
  YouTube,
  layer,
  type SearchOptions,
  type TranscriptOptions,
  type VideoOptions,
  type YouTubeService,
  type YouTubeStack,
} from "./youtube.js";

export interface SearchAllOptions extends SearchOptions {
  /** Stop after this many results. Defaults to 100; pass `Infinity` for all. */
  readonly limit?: number;
}

type SetupError = SessionError | NetworkError | InnertubeError;

/**
 * A Promise-based YouTube client.
 *
 * Effect powers the internals — typed errors, retries, one shared session — but
 * none of that leaks through this surface. Reach for {@link YouTube} and
 * {@link layer} instead if you want the Effect API.
 *
 * Rejections are the same tagged error instances the Effect API fails with, so
 * `catch (error) { if (error._tag === "UnavailableError") … }` works here too.
 */
export class Client {
  readonly #runtime: ManagedRuntime.ManagedRuntime<YouTubeStack, SetupError>;

  private constructor(
    runtime: ManagedRuntime.ManagedRuntime<YouTubeStack, SetupError>,
  ) {
    this.#runtime = runtime;
  }

  /**
   * Creates a client and establishes its Innertube session.
   *
   * Session creation makes network calls, so startup latency and session
   * failures surface here rather than on the first query. Create one client and
   * reuse it — a session is meant to be long-lived.
   */
  static async create(options: ClientOptions = {}): Promise<Client> {
    const runtime = ManagedRuntime.make(layer(options));
    const client = new Client(runtime);
    await client.#run(() => Effect.void);
    return client;
  }

  /** Runs a search and returns a single page, with a continuation token. */
  search(query: string, options?: SearchOptions): Promise<SearchPage> {
    return this.#run((yt) => yt.search(query, options));
  }

  /** Follows continuations until `limit` results are collected. */
  searchAll(
    query: string,
    options: SearchAllOptions = {},
  ): Promise<ReadonlyArray<SearchResult>> {
    const limit = options.limit ?? 100;

    return this.#run((yt) => {
      const results = yt.searchStream(query, options);
      const bounded = Number.isFinite(limit)
        ? Stream.take(results, limit)
        : results;

      return Stream.runCollect(bounded).pipe(
        Effect.map((chunk) => Array.from(chunk)),
      );
    });
  }

  /** Autocomplete suggestions for a partial query. */
  searchSuggestions(query: string): Promise<ReadonlyArray<string>> {
    return this.#run((yt) => yt.searchSuggestions(query));
  }

  /** Full metadata for a video id or URL. */
  getVideo(target: string, options?: VideoOptions): Promise<VideoDetails> {
    return this.#run((yt) => yt.getVideo(target, options));
  }

  /** Timed transcript for a video, when one is published. */
  getTranscript(
    target: string,
    options?: TranscriptOptions,
  ): Promise<Transcript> {
    return this.#run((yt) => yt.getTranscript(target, options));
  }

  /** Channel metadata for a channel id, `@handle`, or channel URL. */
  getChannel(target: string): Promise<ChannelDetails> {
    return this.#run((yt) => yt.getChannel(target));
  }

  /** Releases the session and any work still in flight. */
  async close(): Promise<void> {
    await this.#runtime.dispose();
  }

  /**
   * Runs an effect and rejects with the underlying error.
   *
   * `runPromise` would reject with a `FiberFailure` wrapper, which hides the
   * `_tag` callers need to tell one failure from another.
   */
  async #run<A, E>(
    f: (service: YouTubeService) => Effect.Effect<A, E>,
  ): Promise<A> {
    const exit = await this.#runtime.runPromiseExit(
      Effect.flatMap(YouTube, f),
    );

    if (Exit.isSuccess(exit)) return exit.value;

    const failure = Cause.failureOption(exit.cause);
    throw Option.isSome(failure) ? failure.value : Cause.squash(exit.cause);
  }
}

/** Convenience wrapper over {@link Client.create}. */
export const createClient = (options?: ClientOptions): Promise<Client> =>
  Client.create(options);
