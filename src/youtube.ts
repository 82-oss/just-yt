import { Cause, Effect, Exit, ManagedRuntime, Option } from "effect";
import {
  YouTubeApi,
  layer,
  type SearchOptions,
  type TranscriptOptions,
  type VideoOptions,
  type YouTubeService,
  type YouTubeStack,
} from "./api.js";
import type { YouTubeOptions } from "./config.js";
import type {
  ChannelDetails,
  SearchPage,
  Transcript,
  VideoDetails,
} from "./domain.js";
import type { InnertubeError, NetworkError, SessionError } from "./errors.js";

type SetupError = SessionError | NetworkError | InnertubeError;

/**
 * A YouTube client.
 *
 * ```ts
 * const yt = new YouTube();
 * const video = await yt.video("https://www.youtube.com/watch?v=jNQXAC9IVRw");
 * ```
 *
 * Construction does no I/O: the Innertube session is established on the first
 * call and reused for every call after it. Create one instance and keep it —
 * YouTube treats a session whose identity drifts between requests with
 * suspicion, and each new instance is a new session.
 *
 * Effect powers the internals (typed errors, retries, one shared session) but
 * none of that leaks through here. Rejections are the same tagged error
 * instances the Effect API fails with, so `error._tag` tells you what went
 * wrong. Reach for {@link YouTubeApi} and {@link layer} for the Effect API.
 */
export class YouTube {
  readonly #runtime: ManagedRuntime.ManagedRuntime<YouTubeStack, SetupError>;

  /**
   * @param options - Locale, client identity, timeouts, and the `fetch` to use.
   *   A custom `fetch` is also how you route through a proxy today.
   */
  constructor(options: YouTubeOptions = {}) {
    this.#runtime = ManagedRuntime.make(layer(options));
  }

  /**
   * Runs a search.
   *
   * Returns one page unless `limit` asks for more, in which case continuations
   * are followed until the limit is met or the feed runs out. Pass the returned
   * `continuation` back in to resume where you left off.
   */
  search(query: string, options?: SearchOptions): Promise<SearchPage> {
    return this.#run((yt) => yt.search(query, options));
  }

  /** Autocomplete suggestions for a partial query. */
  suggestions(query: string): Promise<ReadonlyArray<string>> {
    return this.#run((yt) => yt.suggestions(query));
  }

  /**
   * Full metadata for a video.
   *
   * Accepts a bare id or any YouTube URL shape — `watch?v=`, `youtu.be/`,
   * `/shorts/`, `/embed/`, `/live/`.
   */
  video(target: string, options?: VideoOptions): Promise<VideoDetails> {
    return this.#run((yt) => yt.video(target, options));
  }

  /** Timed transcript for a video, when one is published. */
  transcript(
    target: string,
    options?: TranscriptOptions,
  ): Promise<Transcript> {
    return this.#run((yt) => yt.transcript(target, options));
  }

  /** Channel metadata for a channel id, `@handle`, or channel URL. */
  channel(target: string): Promise<ChannelDetails> {
    return this.#run((yt) => yt.channel(target));
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
      Effect.flatMap(YouTubeApi, f),
    );

    if (Exit.isSuccess(exit)) return exit.value;

    const failure = Cause.failureOption(exit.cause);
    throw Option.isSome(failure) ? failure.value : Cause.squash(exit.cause);
  }
}
