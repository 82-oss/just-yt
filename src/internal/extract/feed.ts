/**
 * Feed item extraction.
 *
 * Three of the four recommendation sources — the watch page sidebar, a
 * channel's uploads, and search — now answer with `lockupViewModel`, YouTube's
 * newer renderer-agnostic card. Mix queues still use `playlistPanelVideoRenderer`.
 * Both are handled here so the rest of the pipeline sees one shape.
 *
 * Nothing in this file throws. An item YouTube reshapes is dropped, not fatal,
 * which keeps one unfamiliar card from costing a whole feed.
 */

import type { AuthorRef, FeedItem, SearchResult } from "../../domain.js";
import {
  findAll,
  get,
  getArray,
  getString,
  parseCount,
  parseDuration,
  text,
  thumbnails,
} from "../json.js";
import {
  authorFromRenderer,
  channelUrl,
  handleFromUrl,
  overlayTimeStatus,
  videoUrl,
} from "./common.js";

/** A feed item before provenance and scoring are attached. */
export type RawFeedItem = Omit<FeedItem, "sources" | "score">;

const LIVE_VIEWERS = /watching/i;
const CLOCK = /^\d{1,2}(:\d{2})+$/;

/** `["Veritasium"], ["1.2M views", "3 days ago"]` — one array per rendered line. */
const metadataRows = (lockup: unknown): ReadonlyArray<ReadonlyArray<string>> =>
  getArray(
    lockup,
    "metadata.lockupMetadataViewModel.metadata.contentMetadataViewModel.metadataRows",
  ).map((row) =>
    getArray(row, "metadataParts")
      .map((part) => getString(part, "text.content"))
      .filter((value): value is string => value !== undefined),
  );

const lockupAuthor = (lockup: unknown): AuthorRef | undefined => {
  const metadata = get(lockup, "metadata.lockupMetadataViewModel");
  const rows = metadataRows(lockup);

  // The channel is the only part on the first line; the rest is counts.
  const name = rows[0]?.[0];

  const browse = findAll(metadata, "browseEndpoint").find(
    (endpoint) => getString(endpoint, "browseId")?.startsWith("UC") === true,
  );

  const id = getString(browse, "browseId");
  const canonicalUrl = getString(browse, "canonicalBaseUrl");

  if (name === undefined && id === undefined) return undefined;

  return {
    id,
    name,
    handle: handleFromUrl(canonicalUrl),
    url:
      canonicalUrl !== undefined
        ? `https://www.youtube.com${canonicalUrl}`
        : id !== undefined
          ? channelUrl(id)
          : undefined,
    thumbnails: thumbnails(get(metadata, "image.decoratedAvatarViewModel.avatar.avatarViewModel.image")),
    // Verification rides along as an inline icon rather than a badge here.
    isVerified: findAll(metadata, "imageName").some(
      (icon) => icon === "CHECK_CIRCLE_FILLED",
    ),
  };
};

const fromLockup = (lockup: unknown): RawFeedItem | undefined => {
  if (getString(lockup, "contentType") !== "LOCKUP_CONTENT_TYPE_VIDEO") {
    return undefined;
  }

  const id = getString(lockup, "contentId");
  const title = getString(lockup, "metadata.lockupMetadataViewModel.title.content");
  if (id === undefined || title === undefined) return undefined;

  // Row 0 is the channel; counts and upload age share the rows after it.
  const details = metadataRows(lockup).slice(1).flat();
  const viewCountText = details.find((part) => /view|watching/i.test(part));
  const publishedText = details.find(
    (part) => part !== viewCountText && /ago|Streamed|Premiered/i.test(part),
  );

  const badges = findAll(get(lockup, "contentImage"), "thumbnailBadgeViewModel")
    .map((badge) => getString(badge, "text"))
    .filter((label): label is string => label !== undefined);

  const durationText = badges.find((badge) => CLOCK.test(badge));

  return {
    id,
    title,
    url: videoUrl(id),
    thumbnails: thumbnails(get(lockup, "contentImage.thumbnailViewModel.image")),
    author: lockupAuthor(lockup),
    durationSeconds: parseDuration(durationText),
    durationText,
    viewCount: parseCount(viewCountText),
    viewCountText,
    publishedText,
    isLive:
      badges.some((badge) => /^LIVE$/i.test(badge)) ||
      LIVE_VIEWERS.test(viewCountText ?? ""),
  };
};

const fromPanelVideo = (renderer: unknown): RawFeedItem | undefined => {
  const id = getString(renderer, "videoId");
  const title = text(get(renderer, "title"));
  if (id === undefined || title === undefined) return undefined;

  // A live entry carries no length, so read the overlay rather than inferring
  // liveness from the absence of a duration.
  const overlay = overlayTimeStatus(renderer);
  const durationText = text(get(renderer, "lengthText")) ?? overlay.text;

  return {
    id,
    title,
    url: videoUrl(id),
    thumbnails: thumbnails(get(renderer, "thumbnail")),
    author: authorFromRenderer(renderer),
    durationSeconds: parseDuration(durationText),
    durationText,
    // Mix queue entries carry no view count.
    isLive: overlay.style === "LIVE",
  };
};

/** Every video card in a `/next`, `/browse`, or `/search` response. */
export const feedItemsFromLockups = (
  response: unknown,
): ReadonlyArray<RawFeedItem> =>
  findAll(response, "lockupViewModel")
    .map(fromLockup)
    .filter((item): item is RawFeedItem => item !== undefined);

/** Every entry in a mix / radio queue panel. */
export const feedItemsFromPanel = (
  response: unknown,
): ReadonlyArray<RawFeedItem> =>
  findAll(response, "playlistPanelVideoRenderer")
    .map(fromPanelVideo)
    .filter((item): item is RawFeedItem => item !== undefined);

/** Search already has an extractor; this narrows its output to feed shape. */
export const feedItemsFromSearch = (
  results: ReadonlyArray<SearchResult>,
): ReadonlyArray<RawFeedItem> =>
  results.flatMap((result) =>
    result.type === "video"
      ? [
          {
            id: result.id,
            title: result.title,
            url: result.url,
            thumbnails: result.thumbnails,
            author: result.author,
            durationSeconds: result.durationSeconds,
            durationText: result.durationText,
            viewCount: result.viewCount,
            viewCountText: result.viewCountText,
            publishedText: result.publishedText,
            isLive: result.isLive,
          },
        ]
      : [],
  );
