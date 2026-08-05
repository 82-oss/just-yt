import { Duration, Effect, Schedule } from "effect";
import { Config } from "../config.js";
import { InnertubeError, NetworkError } from "../errors.js";

export interface HttpRequest {
  readonly url: string | URL;
  readonly method?: "GET" | "POST";
  readonly headers?: Record<string, string>;
  readonly body?: string;
  /** Label used in error messages; usually the Innertube endpoint path. */
  readonly label?: string;
}

/** 429 and 5xx are worth another attempt; 4xx means we asked the wrong thing. */
const isTransient = (error: NetworkError | InnertubeError): boolean => {
  if (error._tag === "NetworkError") return true;
  return error.status === 429 || error.status >= 500;
};

const retrySchedule = (retries: number) =>
  Schedule.exponential(Duration.millis(400), 2).pipe(
    Schedule.jittered,
    Schedule.compose(Schedule.recurs(retries)),
    Schedule.whileInput(isTransient),
  );

/**
 * Performs a single HTTP request with the configured timeout, surfacing
 * transport failures and non-2xx responses as distinct errors.
 */
const requestOnce = (
  req: HttpRequest,
): Effect.Effect<Response, NetworkError | InnertubeError, Config> =>
  Effect.gen(function* () {
    const config = yield* Config;
    const url = req.url.toString();
    const label = req.label ?? url;

    const response = yield* Effect.tryPromise({
      try: (signal) =>
        config.fetch(req.url, {
          method: req.method ?? "GET",
          headers: req.headers,
          body: req.body,
          redirect: "follow",
          signal,
        }),
      catch: (cause) =>
        new NetworkError({
          message: `Request to ${url} failed: ${String(cause)}`,
          url,
          cause,
        }),
    }).pipe(
      Effect.timeoutFail({
        duration: Duration.millis(config.timeoutMillis),
        onTimeout: () =>
          new NetworkError({
            message: `Request to ${url} timed out after ${config.timeoutMillis}ms`,
            url,
          }),
      }),
    );

    if (response.ok) return response;

    const body = yield* Effect.promise(() =>
      response.text().catch(() => ""),
    );

    return yield* new InnertubeError({
      message: `${label} failed with status ${response.status}`,
      endpoint: label,
      status: response.status,
      body: body.slice(0, 2_000),
    });
  });

export const request = (
  req: HttpRequest,
): Effect.Effect<Response, NetworkError | InnertubeError, Config> =>
  Effect.gen(function* () {
    const config = yield* Config;
    return yield* Effect.retry(requestOnce(req), retrySchedule(config.retries));
  });

export const requestText = (
  req: HttpRequest,
): Effect.Effect<string, NetworkError | InnertubeError, Config> =>
  request(req).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.text(),
        catch: (cause) =>
          new NetworkError({
            message: `Failed to read response body from ${req.url.toString()}`,
            url: req.url.toString(),
            cause,
          }),
      }),
    ),
  );

export const requestJson = (
  req: HttpRequest,
): Effect.Effect<unknown, NetworkError | InnertubeError, Config> =>
  request(req).pipe(
    Effect.flatMap((response) =>
      Effect.tryPromise({
        try: () => response.json(),
        catch: (cause) =>
          new NetworkError({
            message: `Failed to parse JSON from ${req.url.toString()}`,
            url: req.url.toString(),
            cause,
          }),
      }),
    ),
  );
