import { Context, Effect, Layer } from "effect";
import type { ProxyAgent } from "undici";
import { DESKTOP_USER_AGENTS, type ClientType } from "./internal/constants.js";

export type FetchFn = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface YouTubeOptions {
  /** Interface language, sent as `hl`. Defaults to `"en"`. */
  readonly lang?: string;
  /** Geolocation, sent as `gl`. Defaults to `"US"`. */
  readonly location?: string;
  /** IANA time zone. Defaults to `"America/New_York"`. */
  readonly timezone?: string;
  /** User-agent for requests that do not mandate a client-specific one. */
  readonly userAgent?: string;
  /** Default client identity for requests that do not select one. */
  readonly client?: ClientType;
  /**
   * A persistent visitor data string. Supplying one that YouTube has seen before
   * yields more consistent results across calls; otherwise one is generated.
   */
  readonly visitorData?: string;
  /**
   * Proof-of-Origin token. Improves compatibility on endpoints that check it —
   * it is not a bypass for bot detection, and requests can still be refused.
   */
  readonly poToken?: string;
  /** Restricted mode. */
  readonly enableSafetyMode?: boolean;
  /**
   * Skip the `/sw.js_data` round-trip and synthesise session data locally.
   * Faster to start, but less faithful to what a real browser would send.
   */
  readonly generateSessionLocally?: boolean;
  /**
   * Fail session creation outright if YouTube's session data cannot be
   * retrieved, instead of falling back to locally generated data.
   */
  readonly failFast?: boolean;
  /** Fetch the Innertube config blob during session creation. */
  readonly retrieveInnertubeConfig?: boolean;
  /** Fetch implementation. Defaults to the global `fetch`. */
  readonly fetch?: FetchFn;
  /**
   * HTTP or HTTPS forward proxy used by every request in this client session.
   * Supported in Node.js and Bun. Cannot be combined with a custom `fetch`.
   */
  readonly proxy?: string | URL;
  /** Per-request timeout in milliseconds. Defaults to 20 000. */
  readonly timeoutMillis?: number;
  /** Retry attempts for transient failures. Defaults to 2. */
  readonly retries?: number;
}

export interface ResolvedConfig {
  readonly lang: string;
  readonly location: string;
  readonly timezone: string;
  readonly userAgent: string;
  readonly client: ClientType;
  readonly visitorData?: string;
  readonly poToken?: string;
  readonly enableSafetyMode: boolean;
  readonly generateSessionLocally: boolean;
  readonly failFast: boolean;
  readonly retrieveInnertubeConfig: boolean;
  readonly fetch: FetchFn;
  readonly proxy?: string;
  readonly timeoutMillis: number;
  readonly retries: number;
}

const DEFAULT_TIMEZONE = "America/New_York";

const randomUserAgent = (): string =>
  DESKTOP_USER_AGENTS[Math.floor(Math.random() * DESKTOP_USER_AGENTS.length)];

const proxyDispose = Symbol("just-yt/proxyDispose");

type ProxiedFetch = FetchFn & {
  readonly [proxyDispose]?: () => Promise<void>;
};

const normalizeProxy = (proxy: string | URL): string => {
  let url: URL;

  try {
    url = new URL(proxy);
  } catch {
    throw new TypeError("proxy must be a valid HTTP or HTTPS URL");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new TypeError("proxy must use the http: or https: protocol");
  }

  return url.toString();
};

const isBun = (): boolean =>
  typeof process !== "undefined" && process.versions.bun !== undefined;

const isNode = (): boolean =>
  typeof process !== "undefined" && process.versions.node !== undefined;

/** Creates a runtime-native proxy transport for every request in the session. */
const makeProxiedFetch = (proxy: string): ProxiedFetch => {
  if (isBun()) {
    return async (input, init) => {
      try {
        return await globalThis.fetch(input, {
          ...init,
          // Bun exposes proxying as a fetch extension rather than through an
          // Undici dispatcher.
          proxy,
        } as RequestInit);
      } catch {
        // As on Node, never let a proxy URL containing credentials escape in a
        // runtime-specific error or nested cause.
        throw new Error("Request through the configured proxy failed");
      }
    };
  }

  if (!isNode()) {
    throw new TypeError(
      "proxy is supported only in the Node.js and Bun runtimes",
    );
  }

  let agent: Promise<ProxyAgent> | undefined;

  const getAgent = (): Promise<ProxyAgent> =>
    (agent ??= import("undici").then(
      ({ ProxyAgent: Agent }) => new Agent(proxy),
    ));

  const fetch = (async (input, init) => {
    try {
      const dispatcher = await getAgent();
      return await globalThis.fetch(input, {
        ...init,
        // Node's fetch supports Undici dispatchers, although the standard DOM
        // RequestInit type intentionally does not expose this Node extension.
        dispatcher,
      } as RequestInit);
    } catch {
      // Do not retain the upstream error: proxy libraries may include a URL
      // containing credentials in their messages or nested causes.
      throw new Error("Request through the configured proxy failed");
    }
  }) as ProxiedFetch;

  Object.defineProperty(fetch, proxyDispose, {
    value: async () => {
      if (agent !== undefined) await (await agent).close();
    },
  });

  return fetch;
};

export const resolveConfig = (options: YouTubeOptions = {}): ResolvedConfig => {
  if (options.proxy !== undefined && options.fetch !== undefined) {
    throw new TypeError("proxy and fetch cannot be configured together");
  }

  const proxy =
    options.proxy === undefined ? undefined : normalizeProxy(options.proxy);

  return {
    lang: options.lang ?? "en",
    location: options.location ?? "US",
    timezone: options.timezone ?? DEFAULT_TIMEZONE,
    userAgent: options.userAgent ?? randomUserAgent(),
    client: options.client ?? "WEB",
    visitorData: options.visitorData,
    poToken: options.poToken,
    enableSafetyMode: options.enableSafetyMode ?? false,
    generateSessionLocally: options.generateSessionLocally ?? false,
    failFast: options.failFast ?? false,
    retrieveInnertubeConfig: options.retrieveInnertubeConfig ?? true,
    fetch:
      options.fetch ??
      (proxy === undefined
        ? (input, init) => globalThis.fetch(input, init)
        : makeProxiedFetch(proxy)),
    proxy,
    timeoutMillis: options.timeoutMillis ?? 20_000,
    retries: options.retries ?? 2,
  };
};

export class Config extends Context.Tag("just-yt/Config")<
  Config,
  ResolvedConfig
>() {
  static readonly layer = (options: YouTubeOptions = {}): Layer.Layer<Config> => {
    const config = resolveConfig(options);
    const dispose = (config.fetch as Partial<ProxiedFetch>)[proxyDispose];

    return dispose === undefined
      ? Layer.succeed(Config, config)
      : Layer.scoped(
          Config,
          Effect.acquireRelease(Effect.succeed(config), () =>
            Effect.promise(dispose),
          ),
        );
  };
}
