/**
 * Innertube client profiles and endpoints.
 *
 * These are not credentials we mint — they are the public, hardcoded identities
 * YouTube's own front-ends ship with. Each profile is a fixed request identity
 * (client name, version, user-agent, and where applicable a public API key), and
 * different endpoints behave differently depending on which one you present.
 */

export const URLS = {
  YT_BASE: "https://www.youtube.com",
  YT_MUSIC_BASE: "https://music.youtube.com",
  YT_SUGGESTIONS: "https://suggestqueries-clients6.youtube.com",
  API_PRODUCTION: "https://www.youtube.com/youtubei/",
  GOOGLE_SEARCH_BASE: "https://www.google.com/",
} as const;

export const CLIENTS = {
  WEB: {
    NAME: "WEB",
    VERSION: "2.20260623.01.00",
    API_KEY: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
    API_VERSION: "v1",
    STATIC_VISITOR_ID: "6zpwvWUNAco",
  },
  MWEB: {
    NAME: "MWEB",
    VERSION: "2.20260205.04.01",
    API_VERSION: "v1",
  },
  IOS: {
    NAME: "iOS",
    VERSION: "20.11.6",
    USER_AGENT:
      "com.google.ios.youtube/20.11.6 (iPhone10,4; U; CPU iOS 16_7_7 like Mac OS X)",
    DEVICE_MODEL: "iPhone10,4",
    OS_NAME: "iOS",
    OS_VERSION: "16.7.7.20H330",
  },
  ANDROID: {
    NAME: "ANDROID",
    VERSION: "21.03.36",
    SDK_VERSION: 36,
    USER_AGENT:
      "com.google.android.youtube/21.03.36(Linux; U; Android 16; en_US; SM-S908E Build/TP1A.220624.014) gzip",
  },
  ANDROID_VR: {
    NAME: "ANDROID_VR",
    VERSION: "1.65.10",
    SDK_VERSION: 32,
    DEVICE_MAKE: "Oculus",
    DEVICE_MODEL: "Quest 3",
    USER_AGENT:
      "com.google.android.apps.youtube.vr.oculus/1.65.10 (Linux; U; Android 12L; eureka-user Build/SQ3A.220605.009.A1) gzip",
  },
  TV: {
    NAME: "TVHTML5",
    VERSION: "7.20260311.12.00",
    USER_AGENT: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/Version",
  },
  TV_EMBEDDED: {
    NAME: "TVHTML5_SIMPLY_EMBEDDED_PLAYER",
    VERSION: "2.0",
  },
  WEB_EMBEDDED: {
    NAME: "WEB_EMBEDDED_PLAYER",
    VERSION: "1.20260206.01.00",
    API_KEY: "AIzaSyAO_FJ2SlqU8Q4STEHLGCilw_Y9_11qcW8",
    API_VERSION: "v1",
    STATIC_VISITOR_ID: "6zpwvWUNAco",
  },
} as const;

/** Values for the `X-Youtube-Client-Name` header, keyed by the profile's `NAME`. */
export const CLIENT_NAME_IDS: Record<string, string> = {
  WEB: "1",
  MWEB: "2",
  ANDROID: "3",
  iOS: "5",
  ANDROID_VR: "28",
  TVHTML5: "7",
  TVHTML5_SIMPLY_EMBEDDED_PLAYER: "85",
  WEB_EMBEDDED_PLAYER: "56",
};

/** Client profiles a caller may select per request. */
export type ClientType = keyof typeof CLIENTS;

export const CLIENT_TYPES = Object.keys(CLIENTS) as ReadonlyArray<ClientType>;

export const isClientType = (value: string): value is ClientType =>
  Object.prototype.hasOwnProperty.call(CLIENTS, value);

export const INNERTUBE_HEADERS_BASE = {
  accept: "*/*",
  "accept-language": "*",
  "content-type": "application/json",
} as const;

/**
 * Desktop user-agents used when we generate session data locally. Keeping a
 * small pool avoids every consumer of this library presenting the exact same
 * fingerprint on every request.
 */
export const DESKTOP_USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:126.0) Gecko/20100101 Firefox/126.0",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:126.0) Gecko/20100101 Firefox/126.0",
] as const;

/** Browse IDs that only resolve for a signed-in session, which we do not support. */
export const AUTHENTICATED_BROWSE_IDS = [
  "FElibrary",
  "FEhistory",
  "FEsubscriptions",
  "FEchannels",
  "FEplaylist_aggregation",
  "SPaccount_overview",
  "SPaccount_notifications",
  "SPaccount_privacy",
  "SPtime_watched",
];
