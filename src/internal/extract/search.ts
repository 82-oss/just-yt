import type {
  ChannelSearchResult,
  PlaylistSearchResult,
  SearchPage,
  SearchResult,
  VideoSearchResult,
} from "../../domain.js";
import {
  findAll,
  get,
  getArray,
  getNumber,
  getString,
  isObject,
  parseCount,
  parseDuration,
  text,
  textAt,
  thumbnails,
} from "../json.js";
import {
  authorFromRenderer,
  badgeLabels,
  channelUrl,
  handleFromUrl,
  isVerified,
  overlayTimeStatus,
  playlistUrl,
  thumbnailsFrom,
  videoUrl,
} from "./common.js";

const extractVideo = (node: unknown): VideoSearchResult | undefined => {
  const id = getString(node, "videoId");
  const title = textAt(node, "title");
  if (id === undefined || title === undefined) return undefined;

  const overlay = overlayTimeStatus(node);
  const badges = badgeLabels(get(node, "badges"));

  const durationText = textAt(node, "lengthText") ?? overlay.text;

  const snippets = getArray(node, "detailedMetadataSnippets")
    .map((snippet) => textAt(snippet, "snippetText"))
    .filter((value): value is string => value !== undefined)
    .join("");

  const description =
    textAt(node, "descriptionSnippet") ??
    (snippets.length > 0 ? snippets : undefined);

  const viewCountText =
    textAt(node, "viewCountText") ?? textAt(node, "shortViewCountText");

  return {
    type: "video",
    id,
    title,
    url: videoUrl(id),
    description,
    durationSeconds: parseDuration(durationText),
    durationText,
    thumbnails: thumbnails(get(node, "thumbnail")),
    author: authorFromRenderer(node),
    publishedText: textAt(node, "publishedTimeText"),
    viewCount: parseCount(viewCountText),
    viewCountText,
    isLive:
      overlay.style === "LIVE" ||
      badges.some((badge) => badge.includes("LIVE") || badge === "LIVE"),
    badges,
  };
};

const extractChannel = (node: unknown): ChannelSearchResult | undefined => {
  const id = getString(node, "channelId");
  const title = textAt(node, "title");
  if (id === undefined || title === undefined) return undefined;

  const canonicalUrl = getString(
    node,
    "navigationEndpoint.browseEndpoint.canonicalBaseUrl",
  );

  // YouTube shuffles these two: one holds the handle, the other the sub count,
  // and which is which has changed more than once.
  const first = textAt(node, "subscriberCountText");
  const second = textAt(node, "videoCountText");

  const handleCandidate = [first, second].find((value) =>
    value?.startsWith("@"),
  );
  const subscriberCountText = [first, second].find(
    (value) => value !== undefined && !value.startsWith("@"),
  );

  return {
    type: "channel",
    id,
    title,
    url:
      canonicalUrl !== undefined
        ? `https://www.youtube.com${canonicalUrl}`
        : channelUrl(id),
    handle: handleCandidate ?? handleFromUrl(canonicalUrl),
    description: textAt(node, "descriptionSnippet"),
    thumbnails: thumbnails(get(node, "thumbnail")),
    subscriberCount: parseCount(subscriberCountText),
    subscriberCountText,
    videoCountText: subscriberCountText === second ? first : second,
    isVerified: isVerified(get(node, "ownerBadges")),
  };
};

const extractPlaylist = (node: unknown): PlaylistSearchResult | undefined => {
  const id = getString(node, "playlistId");
  const title = textAt(node, "title");
  if (id === undefined || title === undefined) return undefined;

  return {
    type: "playlist",
    id,
    title,
    url: playlistUrl(id),
    thumbnails: thumbnailsFrom(
      node,
      "thumbnails.0",
      "thumbnail",
      "thumbnailRenderer.playlistVideoThumbnailRenderer.thumbnail",
    ),
    videoCount: getNumber(node, "videoCount") ?? parseCount(textAt(node, "videoCountText")),
    author: authorFromRenderer(node),
  };
};

/**
 * The newer, renderer-agnostic card format. YouTube has been migrating list
 * items to it piecemeal, so both forms show up in the same response.
 */
const extractLockup = (node: unknown): SearchResult | undefined => {
  const id = getString(node, "contentId");
  const contentType = getString(node, "contentType") ?? "";
  const title = textAt(node, "metadata.lockupMetadataViewModel.title");

  if (id === undefined || title === undefined) return undefined;

  const image = thumbnailsFrom(
    node,
    "contentImage.thumbnailViewModel.image",
    "contentImage.collectionThumbnailViewModel.primaryThumbnail.thumbnailViewModel.image",
  );

  if (contentType.includes("PLAYLIST") || contentType.includes("PODCAST")) {
    return {
      type: "playlist",
      id,
      title,
      url: playlistUrl(id),
      thumbnails: image,
      videoCount: undefined,
    };
  }

  if (contentType.includes("CHANNEL")) {
    return {
      type: "channel",
      id,
      title,
      url: channelUrl(id),
      thumbnails: image,
      isVerified: false,
    };
  }

  if (contentType.includes("VIDEO")) {
    return {
      type: "video",
      id,
      title,
      url: videoUrl(id),
      thumbnails: image,
      isLive: false,
      badges: [],
    };
  }

  return undefined;
};

/**
 * Shorts have their own card type and carry no duration or channel — the shelf
 * only renders a title, a view count, and a thumbnail.
 */
const extractShortsLockup = (node: unknown): VideoSearchResult | undefined => {
  const id =
    getString(node, "onTap.innertubeCommand.reelWatchEndpoint.videoId") ??
    getString(node, "entityId")?.replace(/^shorts-shelf-item-/, "");

  const title = textAt(node, "overlayMetadata.primaryText");

  if (id === undefined || title === undefined) return undefined;

  const viewCountText = textAt(node, "overlayMetadata.secondaryText");

  return {
    type: "video",
    id,
    title,
    url: `https://www.youtube.com/shorts/${id}`,
    thumbnails: thumbnails(get(node, "thumbnailViewModel.image")),
    viewCount: parseCount(viewCountText),
    viewCountText,
    isLive: false,
    badges: ["SHORTS"],
  };
};

/** Maps one wrapped item (`{ videoRenderer: {...} }`) to a domain result. */
const extractItem = (item: unknown): SearchResult | undefined => {
  if (!isObject(item)) return undefined;

  if (isObject(item.videoRenderer)) return extractVideo(item.videoRenderer);
  if (isObject(item.compactVideoRenderer))
    return extractVideo(item.compactVideoRenderer);
  if (isObject(item.channelRenderer)) return extractChannel(item.channelRenderer);
  if (isObject(item.playlistRenderer))
    return extractPlaylist(item.playlistRenderer);
  if (isObject(item.lockupViewModel)) return extractLockup(item.lockupViewModel);
  if (isObject(item.shortsLockupViewModel))
    return extractShortsLockup(item.shortsLockupViewModel);
  if (isObject(item.reelItemRenderer)) return extractVideo(item.reelItemRenderer);

  return undefined;
};

/**
 * Walks a search response for renderable items.
 *
 * Shelves (`shelfRenderer`, `reelShelfRenderer`) nest their own item lists, and
 * continuation responses wrap everything one level deeper again, so we collect
 * every item section rather than following a fixed path.
 */
const collectItems = (response: unknown): ReadonlyArray<SearchResult> => {
  const containers = [
    ...findAll(response, "itemSectionRenderer"),
    ...findAll(response, "shelfRenderer"),
    ...findAll(response, "reelShelfRenderer"),
    ...findAll(response, "richItemRenderer"),
    ...findAll(response, "gridShelfViewModel"),
  ];

  const seen = new Set<string>();
  const results: SearchResult[] = [];

  for (const container of containers) {
    const items = [
      ...getArray(container, "contents"),
      ...getArray(container, "items"),
      ...getArray(container, "content.verticalListRenderer.items"),
      ...getArray(container, "content.horizontalListRenderer.items"),
      ...(isObject(get(container, "content")) ? [get(container, "content")] : []),
    ];

    for (const item of items) {
      const result = extractItem(item);
      if (result === undefined) continue;

      const key = `${result.type}:${result.id}`;
      if (seen.has(key)) continue;

      seen.add(key);
      results.push(result);
    }
  }

  return results;
};

/**
 * Reads the continuation token for the next page.
 *
 * Shelves carry their own continuations, so the outermost list's token — the
 * last one in document order — is the one that advances the feed.
 */
const extractContinuation = (response: unknown): string | undefined => {
  const tokens = findAll(response, "continuationItemRenderer")
    .map((renderer) =>
      getString(
        renderer,
        "continuationEndpoint.continuationCommand.token",
      ),
    )
    .filter((token): token is string => token !== undefined);

  return tokens.at(-1);
};

export const extractSearchPage = (response: unknown): SearchPage => ({
  results: collectItems(response),
  estimatedResults: parseCount(getString(response, "estimatedResults")),
  continuation: extractContinuation(response),
});

/** Search suggestions come back as a JSONP-wrapped array, not Innertube JSON. */
export const extractSuggestions = (payload: string): ReadonlyArray<string> => {
  const start = payload.indexOf("(");
  const end = payload.lastIndexOf(")");
  if (start === -1 || end === -1) return [];

  try {
    const parsed = JSON.parse(payload.slice(start + 1, end)) as unknown;
    return getArray(parsed, "1").flatMap((entry) => {
      const suggestion = get(entry, "0");
      return typeof suggestion === "string" ? [suggestion] : [];
    });
  } catch {
    return [];
  }
};
