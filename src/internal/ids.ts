/**
 * Input normalisation.
 *
 * Callers pass whatever they have — a bare id, a share link, a handle, a
 * `/shorts/` URL — and these turn it into the identifier Innertube expects.
 */

const VIDEO_ID = /^[\w-]{11}$/;
const CHANNEL_ID = /^UC[\w-]{22}$/;

export const isVideoId = (value: string): boolean => VIDEO_ID.test(value);

export const isChannelId = (value: string): boolean => CHANNEL_ID.test(value);

/** Extracts a video id from an id or any of YouTube's URL shapes. */
export const parseVideoId = (input: string): string | undefined => {
  const trimmed = input.trim();
  if (isVideoId(trimmed)) return trimmed;

  let url: URL;
  try {
    url = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`);
  } catch {
    return undefined;
  }

  const host = url.hostname.replace(/^(www|m|music)\./, "");

  if (host === "youtu.be") {
    const candidate = url.pathname.slice(1).split("/")[0];
    return isVideoId(candidate) ? candidate : undefined;
  }

  if (host !== "youtube.com" && host !== "youtube-nocookie.com") {
    return undefined;
  }

  const fromQuery = url.searchParams.get("v");
  if (fromQuery !== null && isVideoId(fromQuery)) return fromQuery;

  const segments = url.pathname.split("/").filter((part) => part.length > 0);
  if (
    segments.length >= 2 &&
    ["shorts", "embed", "live", "v"].includes(segments[0])
  ) {
    return isVideoId(segments[1]) ? segments[1] : undefined;
  }

  return undefined;
};

export type ChannelTarget =
  | { readonly _tag: "browseId"; readonly browseId: string }
  /** Needs a `/navigation/resolve_url` round-trip before it can be browsed. */
  | { readonly _tag: "url"; readonly url: string };

/** Classifies a channel identifier as directly browsable or needing resolution. */
export const parseChannelTarget = (input: string): ChannelTarget => {
  const trimmed = input.trim();

  if (isChannelId(trimmed)) return { _tag: "browseId", browseId: trimmed };

  if (trimmed.startsWith("@")) {
    return { _tag: "url", url: `https://www.youtube.com/${trimmed}` };
  }

  if (/^https?:\/\//.test(trimmed)) {
    // `/channel/UC…` needs no resolution.
    const match = trimmed.match(/\/channel\/(UC[\w-]{22})/);
    if (match !== null) return { _tag: "browseId", browseId: match[1] };
    return { _tag: "url", url: trimmed };
  }

  return { _tag: "url", url: `https://www.youtube.com/@${trimmed}` };
};
