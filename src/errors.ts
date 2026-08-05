import { Data } from "effect";

/**
 * The request never reached YouTube, or the response could not be read.
 * Transport-level failures only — a non-2xx response is an {@link InnertubeError}.
 */
export class NetworkError extends Data.TaggedError("NetworkError")<{
  readonly message: string;
  readonly url: string;
  readonly cause?: unknown;
}> {}

/**
 * Session data could not be established, so no Innertube request can be made.
 */
export class SessionError extends Data.TaggedError("SessionError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * YouTube answered an Innertube call with a non-2xx status.
 */
export class InnertubeError extends Data.TaggedError("InnertubeError")<{
  readonly message: string;
  readonly endpoint: string;
  readonly status: number;
  readonly body?: string;
}> {}

/**
 * The response arrived but did not have the shape we expect.
 *
 * YouTube reshapes its renderers without notice, so this is the error to watch:
 * `path` points at where extraction gave up, which is what you need to fix a drift.
 */
export class ExtractionError extends Data.TaggedError("ExtractionError")<{
  readonly message: string;
  readonly path: string;
  readonly received?: unknown;
}> {}

/**
 * The requested resource does not exist, or YouTube will not serve it to us.
 */
export class NotFoundError extends Data.TaggedError("NotFoundError")<{
  readonly message: string;
  readonly kind: "video" | "channel" | "playlist" | "transcript";
  readonly id: string;
}> {}

/**
 * The video exists but is not playable — private, members-only, age-gated,
 * region-blocked, or withheld by bot detection.
 */
export class UnavailableError extends Data.TaggedError("UnavailableError")<{
  readonly message: string;
  readonly videoId: string;
  readonly status: string;
  readonly reason?: string;
}> {}

export type JustYtError =
  | NetworkError
  | SessionError
  | InnertubeError
  | ExtractionError
  | NotFoundError
  | UnavailableError;
