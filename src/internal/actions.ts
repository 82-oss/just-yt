import { Context, Effect, Layer } from "effect";
import { Config } from "../config.js";
import { InnertubeError, NetworkError } from "../errors.js";
import {
  AUTHENTICATED_BROWSE_IDS,
  CLIENT_NAME_IDS,
  CLIENTS,
  URLS,
  type ClientType,
} from "./constants.js";
import { adjustContextForClient, userAgentForClient } from "./context.js";
import { requestJson } from "./http.js";
import { get, getString } from "./json.js";
import { Session } from "./session.js";

/** Innertube endpoints this library talks to. */
export type Endpoint =
  | "/player"
  | "/next"
  | "/search"
  | "/browse"
  | "/get_transcript"
  | "/navigation/resolve_url"
  | (string & {});

export interface ExecuteOptions {
  /** Client identity to present for this call. Defaults to the session's. */
  readonly client?: ClientType;
  /** Attach the configured proof-of-origin token to the request. */
  readonly withPoToken?: boolean;
}

export interface InnertubeService {
  /** Executes an Innertube call and returns the raw response body. */
  readonly execute: (
    endpoint: Endpoint,
    payload?: Record<string, unknown>,
    options?: ExecuteOptions,
  ) => Effect.Effect<unknown, NetworkError | InnertubeError>;
}

export class Innertube extends Context.Tag("just-yt/Innertube")<
  Innertube,
  InnertubeService
>() {}

/**
 * `/browse` responses sometimes answer with a redirect instead of content —
 * most commonly when resolving a channel handle to its canonical browse id.
 */
export const navigateActionBrowseId = (
  response: unknown,
): { readonly browseId?: string; readonly params?: string } | undefined => {
  const action = get(response, "onResponseReceivedActions.0.navigateAction");
  if (action === undefined) return undefined;

  const browseId = getString(action, "endpoint.browseEndpoint.browseId");
  if (browseId === undefined) return undefined;

  return {
    browseId,
    params: getString(action, "endpoint.browseEndpoint.params"),
  };
};

const makeInnertube = Effect.gen(function* () {
  const config = yield* Config;
  const session = yield* Session;

  const execute: InnertubeService["execute"] = (
    endpoint,
    payload = {},
    options = {},
  ) =>
    Effect.gen(function* () {
      const client = options.client ?? config.client;
      const context = adjustContextForClient(session.context, client);
      const clientNameId = CLIENT_NAME_IDS[context.client.clientName];

      const browseId = payload.browseId;
      if (
        typeof browseId === "string" &&
        AUTHENTICATED_BROWSE_IDS.includes(browseId)
      ) {
        return yield* new InnertubeError({
          message: `Browse id "${browseId}" requires an authenticated session, which just-yt does not support`,
          endpoint,
          status: 401,
        });
      }

      const body: Record<string, unknown> = { context, ...payload };

      if (options.withPoToken === true && config.poToken !== undefined) {
        body.serviceIntegrityDimensions = { poToken: config.poToken };
      }

      const url = new URL(
        `${URLS.API_PRODUCTION}${session.apiVersion}${endpoint}`,
      );
      url.searchParams.set("prettyPrint", "false");
      url.searchParams.set("alt", "json");

      const headers: Record<string, string> = {
        Accept: "*/*",
        "Accept-Language": "*",
        "Content-Type": "application/json",
        Origin: URLS.YT_BASE,
        Referer: URLS.YT_BASE,
        "User-Agent": userAgentForClient(client, config.userAgent),
        "X-Goog-Visitor-Id": context.client.visitorData ?? "",
        "X-Youtube-Client-Version": context.client.clientVersion,
      };

      if (clientNameId !== undefined) {
        headers["X-Youtube-Client-Name"] = clientNameId;
      }

      // The Android clients speak a newer wire format and reject the default.
      if (
        context.client.clientName === CLIENTS.ANDROID.NAME ||
        context.client.clientName === CLIENTS.ANDROID_VR.NAME
      ) {
        headers["X-Goog-Api-Format-Version"] = "2";
      }

      return yield* requestJson({
        url,
        label: endpoint,
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
    }).pipe(Effect.provideService(Config, config));

  return { execute } satisfies InnertubeService;
});

export const InnertubeLive: Layer.Layer<Innertube, never, Config | Session> =
  Layer.effect(Innertube, makeInnertube);
