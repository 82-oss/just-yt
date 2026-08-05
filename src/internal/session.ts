import { Context, Effect, Layer } from "effect";
import { Config } from "../config.js";
import { InnertubeError, NetworkError, SessionError } from "../errors.js";
import { CLIENTS, URLS } from "./constants.js";
import {
  buildContext,
  type ContextData,
  type InnertubeContext,
} from "./context.js";
import { requestJson, requestText } from "./http.js";
import { get, getString, isArray } from "./json.js";
import { decodeVisitorId, generateRandomString, generateVisitorData } from "./params.js";

/**
 * Everything an Innertube request needs to look like it came from a real client.
 *
 * One of these is built per client instance and reused for every call, so
 * visitor data, locale, and config hashes stay consistent — YouTube treats a
 * session whose identity drifts between requests with suspicion.
 */
export interface SessionState {
  readonly context: InnertubeContext;
  readonly apiKey: string;
  readonly apiVersion: string;
  readonly configData?: string;
}

export class Session extends Context.Tag("just-yt/Session")<
  Session,
  SessionState
>() {}

/**
 * Scrapes YouTube's service worker bootstrap for a live client config.
 *
 * `/sw.js_data` returns a JSPB array (guarded by an anti-hijacking prefix)
 * carrying the same `ytcfg` values a browser would receive: visitor data, the
 * current WEB client version, locale, and the app install blob. The numeric
 * indices below are positional in that array and are the most breakage-prone
 * part of session creation — hence the fallback path in {@link makeSession}.
 */
const fetchRemoteSessionData = Effect.gen(function* () {
  const config = yield* Config;

  const visitorId =
    (config.visitorData !== undefined
      ? decodeVisitorId(config.visitorData)
      : undefined) ?? generateRandomString(11);

  const raw = yield* requestText({
    url: new URL("/sw.js_data", URLS.YT_BASE),
    label: "/sw.js_data",
    headers: {
      "Accept-Language": config.lang || "en-US",
      "User-Agent": config.userAgent,
      Accept: "*/*",
      Referer: `${URLS.YT_BASE}/sw.js`,
      Cookie: `PREF=tz=${config.timezone.replace("/", ".")};VISITOR_INFO1_LIVE=${visitorId};`,
    },
  });

  if (!raw.startsWith(")]}'")) {
    return yield* new SessionError({
      message: "Unexpected /sw.js_data response: missing JSPB guard prefix",
    });
  }

  const parsed = yield* Effect.try({
    try: () => JSON.parse(raw.replace(/^\)\]\}'/, "")) as unknown,
    catch: (cause) =>
      new SessionError({
        message: "Failed to parse /sw.js_data payload",
        cause,
      }),
  });

  const ytcfg = get(parsed, "0.2");
  const deviceInfo = get(ytcfg, "0.0");
  const apiKey = get(ytcfg, "1");

  if (!isArray(deviceInfo) || typeof apiKey !== "string") {
    return yield* new SessionError({
      message:
        "Unexpected /sw.js_data layout: could not locate device info or API key",
    });
  }

  const at = (index: number): string | undefined => {
    const value = deviceInfo[index];
    return typeof value === "string" ? value : undefined;
  };

  const configInfo = deviceInfo[61];
  const appInstallData = isArray(configInfo)
    ? typeof configInfo[configInfo.length - 1] === "string"
      ? (configInfo[configInfo.length - 1] as string)
      : undefined
    : undefined;

  const contextData: ContextData = {
    hl: config.lang || at(0) || "en",
    gl: config.location || at(1) || "US",
    remoteHost: at(3),
    visitorData: config.visitorData ?? at(13) ?? generateVisitorData(),
    clientName: CLIENTS.WEB.NAME,
    clientVersion: at(16) ?? CLIENTS.WEB.VERSION,
    userAgent: config.userAgent,
    osName: at(17) ?? "Windows",
    osVersion: at(18) ?? "10.0",
    browserName: at(86) ?? "Chrome",
    browserVersion: at(87) ?? "125.0.0.0",
    deviceMake: at(11) ?? "",
    deviceModel: at(12) ?? "",
    deviceExperimentId: at(103),
    rolloutToken: at(107),
    appInstallData,
    timeZone: at(79) ?? config.timezone,
    enableSafetyMode: config.enableSafetyMode,
  };

  return { contextData, apiKey } as const;
});

/** Session data synthesised without contacting YouTube. */
const localSessionData = Effect.gen(function* () {
  const config = yield* Config;

  const contextData: ContextData = {
    hl: config.lang,
    gl: config.location,
    visitorData: config.visitorData ?? generateVisitorData(),
    clientName: CLIENTS.WEB.NAME,
    clientVersion: CLIENTS.WEB.VERSION,
    userAgent: config.userAgent,
    osName: "Windows",
    osVersion: "10.0",
    browserName: "Chrome",
    browserVersion: "125.0.0.0",
    deviceMake: "",
    deviceModel: "",
    timeZone: config.timezone,
    enableSafetyMode: config.enableSafetyMode,
  };

  return { contextData, apiKey: CLIENTS.WEB.API_KEY } as const;
});

/**
 * Fetches `/youtubei/v1/config`, which returns the cold/hot config hashes that
 * accompany a genuine WEB session. Purely additive: a failure here costs some
 * fidelity, not the session.
 */
const attachInnertubeConfig = (
  context: InnertubeContext,
): Effect.Effect<
  { readonly context: InnertubeContext; readonly configData?: string },
  never,
  Config
> =>
  Effect.gen(function* () {
    const config = yield* Config;

    const response = yield* requestJson({
      url: `${URLS.API_PRODUCTION}${CLIENTS.WEB.API_VERSION}/config?prettyPrint=false`,
      label: "/config",
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "*/*",
        "Accept-Language": config.lang,
        Referer: URLS.YT_BASE,
        Origin: URLS.YT_BASE,
        "User-Agent": config.userAgent,
        "X-Origin": URLS.YT_BASE,
        "X-Goog-Visitor-Id": context.client.visitorData ?? "",
        "X-Youtube-Client-Version": context.client.clientVersion,
      },
      body: JSON.stringify({ context }),
    });

    const group = get(response, "responseContext.globalConfigGroup");

    return {
      context: {
        ...context,
        client: {
          ...context.client,
          configInfo: {
            ...context.client.configInfo,
            coldConfigData: getString(group, "rawColdConfigGroup.configData"),
            coldHashData: getString(group, "coldHashData"),
            hotHashData: getString(group, "hotHashData"),
          },
        },
      },
      configData: getString(response, "configData"),
    };
  }).pipe(
    // Config data is an optimisation, never a prerequisite.
    Effect.catchAll(() => Effect.succeed({ context })),
  );

export const makeSession: Effect.Effect<
  SessionState,
  SessionError | NetworkError | InnertubeError,
  Config
> = Effect.gen(function* () {
  const config = yield* Config;

  const source = config.generateSessionLocally
    ? localSessionData
    : fetchRemoteSessionData.pipe(
        Effect.catchAll((error) =>
          config.failFast
            ? Effect.fail(
                new SessionError({
                  message: `Failed to retrieve session data from YouTube: ${error.message}`,
                  cause: error,
                }),
              )
            : Effect.logDebug(
                `just-yt: falling back to locally generated session data (${error.message})`,
              ).pipe(Effect.zipRight(localSessionData)),
        ),
      );

  const { contextData, apiKey } = yield* source;
  const baseContext = buildContext(contextData);

  const { context, configData } = config.retrieveInnertubeConfig
    ? yield* attachInnertubeConfig(baseContext)
    : { context: baseContext, configData: undefined };

  return {
    context,
    apiKey,
    apiVersion: CLIENTS.WEB.API_VERSION,
    configData,
  };
});

export const SessionLive: Layer.Layer<
  Session,
  SessionError | NetworkError | InnertubeError,
  Config
> = Layer.effect(Session, makeSession);
