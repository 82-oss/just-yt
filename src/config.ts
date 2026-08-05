import { Context, Layer } from "effect";
import { DESKTOP_USER_AGENTS, type ClientType } from "./internal/constants.js";

export type FetchFn = (
  input: string | URL,
  init?: RequestInit,
) => Promise<Response>;

export interface ClientOptions {
  /** Interface language, sent as `hl`. Defaults to `"en"`. */
  readonly lang?: string;
  /** Geolocation, sent as `gl`. Defaults to `"US"`. */
  readonly location?: string;
  /** IANA time zone. Defaults to the host's. */
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
  readonly timeoutMillis: number;
  readonly retries: number;
}

const defaultTimezone = (): string => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? "UTC";
  } catch {
    return "UTC";
  }
};

const randomUserAgent = (): string =>
  DESKTOP_USER_AGENTS[Math.floor(Math.random() * DESKTOP_USER_AGENTS.length)];

export const resolveConfig = (options: ClientOptions = {}): ResolvedConfig => ({
  lang: options.lang ?? "en",
  location: options.location ?? "US",
  timezone: options.timezone ?? defaultTimezone(),
  userAgent: options.userAgent ?? randomUserAgent(),
  client: options.client ?? "WEB",
  visitorData: options.visitorData,
  poToken: options.poToken,
  enableSafetyMode: options.enableSafetyMode ?? false,
  generateSessionLocally: options.generateSessionLocally ?? false,
  failFast: options.failFast ?? false,
  retrieveInnertubeConfig: options.retrieveInnertubeConfig ?? true,
  fetch: options.fetch ?? ((input, init) => globalThis.fetch(input, init)),
  timeoutMillis: options.timeoutMillis ?? 20_000,
  retries: options.retries ?? 2,
});

export class Config extends Context.Tag("just-yt/Config")<
  Config,
  ResolvedConfig
>() {
  static readonly layer = (options: ClientOptions = {}): Layer.Layer<Config> =>
    Layer.succeed(Config, resolveConfig(options));
}
