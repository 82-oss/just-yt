import { CLIENTS, type ClientType, URLS } from "./constants.js";

/**
 * The `context` object sent with every Innertube request.
 *
 * YouTube keys a great deal of behaviour off this — available renderers,
 * response shape, even whether a video is playable at all — so it is built once
 * per session and adjusted per request when a call needs a different client.
 */
export interface InnertubeContext {
  client: {
    hl: string;
    gl: string;
    remoteHost?: string;
    visitorData?: string;
    clientName: string;
    clientVersion: string;
    clientScreen?: string;
    clientFormFactor: string;
    androidSdkVersion?: number;
    osName: string;
    osVersion: string;
    platform: string;
    userAgent: string;
    browserName?: string;
    browserVersion?: string;
    deviceMake: string;
    deviceModel: string;
    deviceExperimentId?: string;
    rolloutToken?: string;
    timeZone: string;
    utcOffsetMinutes: number;
    userInterfaceTheme?: string;
    originalUrl?: string;
    screenDensityFloat?: number;
    screenHeightPoints?: number;
    screenPixelDensity?: number;
    screenWidthPoints?: number;
    memoryTotalKbytes?: string;
    mainAppWebInfo?: {
      graftUrl: string;
      pwaInstallabilityStatus: string;
      webDisplayMode: string;
      isWebNativeShareAvailable: boolean;
    };
    configInfo?: {
      appInstallData?: string;
      coldConfigData?: string;
      coldHashData?: string;
      hotHashData?: string;
    };
  };
  user: {
    enableSafetyMode: boolean;
    lockedSafetyMode: boolean;
  };
  request?: {
    useSsl: boolean;
    internalExperimentFlags: ReadonlyArray<unknown>;
  };
  thirdParty?: {
    embedUrl: string;
  };
}

/** The device/locale facts a context is built from, however they were sourced. */
export interface ContextData {
  readonly hl: string;
  readonly gl: string;
  readonly remoteHost?: string;
  readonly visitorData: string;
  readonly clientName: string;
  readonly clientVersion: string;
  readonly userAgent: string;
  readonly osName: string;
  readonly osVersion: string;
  readonly browserName?: string;
  readonly browserVersion?: string;
  readonly deviceMake: string;
  readonly deviceModel: string;
  readonly deviceExperimentId?: string;
  readonly rolloutToken?: string;
  readonly appInstallData?: string;
  readonly timeZone: string;
  readonly enableSafetyMode: boolean;
}

export const buildContext = (data: ContextData): InnertubeContext => {
  const context: InnertubeContext = {
    client: {
      hl: data.hl || "en",
      gl: data.gl || "US",
      remoteHost: data.remoteHost,
      visitorData: data.visitorData,
      clientName: data.clientName,
      clientVersion: data.clientVersion,
      clientFormFactor: "UNKNOWN_FORM_FACTOR",
      osName: data.osName,
      osVersion: data.osVersion,
      platform: "DESKTOP",
      userAgent: data.userAgent,
      browserName: data.browserName,
      browserVersion: data.browserVersion,
      deviceMake: data.deviceMake,
      deviceModel: data.deviceModel,
      deviceExperimentId: data.deviceExperimentId,
      rolloutToken: data.rolloutToken,
      timeZone: data.timeZone,
      utcOffsetMinutes: -Math.floor(new Date().getTimezoneOffset()),
      userInterfaceTheme: "USER_INTERFACE_THEME_LIGHT",
      originalUrl: URLS.YT_BASE,
      screenDensityFloat: 1,
      screenHeightPoints: 1440,
      screenPixelDensity: 1,
      screenWidthPoints: 2560,
      memoryTotalKbytes: "8000000",
      mainAppWebInfo: {
        graftUrl: URLS.YT_BASE,
        pwaInstallabilityStatus: "PWA_INSTALLABILITY_STATUS_UNKNOWN",
        webDisplayMode: "WEB_DISPLAY_MODE_BROWSER",
        isWebNativeShareAvailable: true,
      },
    },
    user: {
      enableSafetyMode: data.enableSafetyMode,
      lockedSafetyMode: false,
    },
    request: {
      useSsl: true,
      internalExperimentFlags: [],
    },
  };

  if (data.appInstallData !== undefined) {
    context.client.configInfo = { appInstallData: data.appInstallData };
  }

  return context;
};

const clone = (context: InnertubeContext): InnertubeContext =>
  JSON.parse(JSON.stringify(context)) as InnertubeContext;

/**
 * Rewrites a session context to present a different client identity.
 *
 * Endpoints disagree about which client they serve best: `/player` answers most
 * reliably to iOS or ANDROID, while `/next`, `/browse` and `/search` only return
 * the full web renderers to WEB. Rather than hold several sessions, we hold one
 * and re-stamp its identity per request.
 */
export const adjustContextForClient = (
  base: InnertubeContext,
  client: ClientType,
): InnertubeContext => {
  const context = clone(base);

  // Config info is issued for WEB and confuses every other client.
  if (client !== "WEB") {
    delete context.client.configInfo;
  }

  switch (client) {
    case "WEB":
      break;

    case "MWEB":
      context.client.clientName = CLIENTS.MWEB.NAME;
      context.client.clientVersion = CLIENTS.MWEB.VERSION;
      context.client.clientFormFactor = "SMALL_FORM_FACTOR";
      context.client.platform = "MOBILE";
      break;

    case "IOS":
      context.client.clientName = CLIENTS.IOS.NAME;
      context.client.clientVersion = CLIENTS.IOS.VERSION;
      context.client.deviceMake = "Apple";
      context.client.deviceModel = CLIENTS.IOS.DEVICE_MODEL;
      context.client.osName = CLIENTS.IOS.OS_NAME;
      context.client.osVersion = CLIENTS.IOS.OS_VERSION;
      context.client.userAgent = CLIENTS.IOS.USER_AGENT;
      context.client.platform = "MOBILE";
      delete context.client.browserName;
      delete context.client.browserVersion;
      break;

    case "ANDROID":
      context.client.clientName = CLIENTS.ANDROID.NAME;
      context.client.clientVersion = CLIENTS.ANDROID.VERSION;
      context.client.androidSdkVersion = CLIENTS.ANDROID.SDK_VERSION;
      context.client.userAgent = CLIENTS.ANDROID.USER_AGENT;
      context.client.osName = "Android";
      context.client.osVersion = "13";
      context.client.platform = "MOBILE";
      context.client.clientFormFactor = "SMALL_FORM_FACTOR";
      delete context.client.browserName;
      delete context.client.browserVersion;
      break;

    case "ANDROID_VR":
      context.client.clientName = CLIENTS.ANDROID_VR.NAME;
      context.client.clientVersion = CLIENTS.ANDROID_VR.VERSION;
      context.client.androidSdkVersion = CLIENTS.ANDROID_VR.SDK_VERSION;
      context.client.userAgent = CLIENTS.ANDROID_VR.USER_AGENT;
      context.client.deviceMake = CLIENTS.ANDROID_VR.DEVICE_MAKE;
      context.client.deviceModel = CLIENTS.ANDROID_VR.DEVICE_MODEL;
      context.client.osName = "Android";
      context.client.osVersion = "12L";
      context.client.platform = "MOBILE";
      context.client.clientFormFactor = "SMALL_FORM_FACTOR";
      delete context.client.browserName;
      delete context.client.browserVersion;
      break;

    case "TV":
      context.client.clientName = CLIENTS.TV.NAME;
      context.client.clientVersion = CLIENTS.TV.VERSION;
      context.client.userAgent = CLIENTS.TV.USER_AGENT;
      break;

    case "TV_EMBEDDED":
      context.client.clientName = CLIENTS.TV_EMBEDDED.NAME;
      context.client.clientVersion = CLIENTS.TV_EMBEDDED.VERSION;
      context.client.clientScreen = "EMBED";
      context.thirdParty = { embedUrl: URLS.YT_BASE };
      break;

    case "WEB_EMBEDDED":
      context.client.clientName = CLIENTS.WEB_EMBEDDED.NAME;
      context.client.clientVersion = CLIENTS.WEB_EMBEDDED.VERSION;
      context.client.clientScreen = "EMBED";
      context.thirdParty = { embedUrl: URLS.GOOGLE_SEARCH_BASE };
      break;
  }

  return context;
};

/** The user-agent header to send for a client, if it mandates one. */
export const userAgentForClient = (
  client: ClientType,
  fallback: string,
): string => {
  switch (client) {
    case "IOS":
      return CLIENTS.IOS.USER_AGENT;
    case "ANDROID":
      return CLIENTS.ANDROID.USER_AGENT;
    case "ANDROID_VR":
      return CLIENTS.ANDROID_VR.USER_AGENT;
    case "TV":
      return CLIENTS.TV.USER_AGENT;
    default:
      return fallback;
  }
};
