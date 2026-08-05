import { Effect } from "effect";
import type { ChannelDetails, ChannelLink } from "../../domain.js";
import { ExtractionError } from "../../errors.js";
import {
  findAll,
  findFirst,
  get,
  getArray,
  getBoolean,
  getString,
  parseCount,
  textAt,
  thumbnails,
} from "../json.js";
import { channelUrl, handleFromUrl, isVerified, thumbnailsFrom } from "./common.js";

/**
 * Finds the continuations that load the channel's About panel.
 *
 * The header ships the panel as a continuation rather than inline content, so
 * subscriber counts, join date, country, and links need a second `/browse`
 * call. The search is scoped to the header subtree deliberately: the channel
 * body carries its own, unrelated continuations for the video grid, and those
 * appear earlier in the response.
 */
export const aboutContinuationTokens = (
  response: unknown,
): ReadonlyArray<string> => {
  const seen = new Set<string>();

  for (const command of findAll(get(response, "header"), "continuationCommand")) {
    const token = getString(command, "token");
    if (token !== undefined) seen.add(token);
  }

  return Array.from(seen);
};

const firstNonEmpty = <A>(
  ...candidates: ReadonlyArray<ReadonlyArray<A>>
): ReadonlyArray<A> => candidates.find((list) => list.length > 0) ?? [];

const externalLinks = (about: unknown): ReadonlyArray<ChannelLink> =>
  getArray(about, "links").flatMap((link) => {
    const view = get(link, "channelExternalLinkViewModel") ?? link;
    const title = textAt(view, "title");
    const url =
      textAt(view, "link") ??
      getString(view, "link.commandRuns.0.onTap.innertubeCommand.urlEndpoint.url");
    if (title === undefined && url === undefined) return [];
    return [{ title, url }];
  });

/**
 * Builds channel details from a `/browse` response.
 *
 * Three sources are merged, in decreasing order of reliability:
 * `channelMetadataRenderer` (stable, sparse), the About view-model (rich, only
 * present after the continuation), and the header — which exists in both a
 * legacy `c4TabbedHeaderRenderer` and a newer `pageHeaderRenderer` form.
 */
export const extractChannelDetails = (
  response: unknown,
  about: unknown,
): Effect.Effect<ChannelDetails, ExtractionError> =>
  Effect.gen(function* () {
    const metadata = get(response, "metadata.channelMetadataRenderer");
    const microformat = get(response, "microformat.microformatDataRenderer");
    const legacyHeader = findFirst(response, "c4TabbedHeaderRenderer");
    const pageHeader = findFirst(response, "pageHeaderViewModel");
    const aboutView = about ?? findFirst(response, "aboutChannelViewModel");

    const id =
      getString(metadata, "externalId") ??
      getString(aboutView, "channelId") ??
      getString(legacyHeader, "channelId");

    if (id === undefined) {
      return yield* new ExtractionError({
        message: "Browse response did not identify a channel",
        path: "metadata.channelMetadataRenderer.externalId",
        received: getString(response, "responseContext.visitorData"),
      });
    }

    const title =
      getString(metadata, "title") ??
      textAt(legacyHeader, "title") ??
      textAt(pageHeader, "title") ??
      "";

    const vanityUrl =
      getString(metadata, "vanityChannelUrl") ??
      getString(aboutView, "canonicalChannelUrl") ??
      getString(microformat, "urlCanonical");

    const handle =
      textAt(legacyHeader, "channelHandleText") ??
      handleFromUrl(vanityUrl) ??
      handleFromUrl(getString(metadata, "ownerUrls.0"));

    // The header renders counts as free text rows; the About panel gives the
    // same figures with stable keys, so it wins when present.
    const headerRows = getArray(
      pageHeader,
      "metadata.contentMetadataViewModel.metadataRows",
    ).flatMap((row) =>
      getArray(row, "metadataParts").flatMap((part) => {
        const value = textAt(part, "text");
        return value === undefined ? [] : [value];
      }),
    );

    const subscriberCountText =
      getString(aboutView, "subscriberCountText") ??
      textAt(legacyHeader, "subscriberCountText") ??
      headerRows.find((row) => /subscriber/i.test(row));

    const videoCountText =
      getString(aboutView, "videoCountText") ??
      textAt(legacyHeader, "videosCountText") ??
      headerRows.find((row) => /video/i.test(row));

    const viewCountText = getString(aboutView, "viewCountText");

    return {
      id,
      title,
      handle,
      url: channelUrl(id),
      canonicalUrl: vanityUrl,
      description:
        getString(metadata, "description") ??
        getString(aboutView, "description") ??
        textAt(pageHeader, "description"),
      thumbnails: firstNonEmpty(
        thumbnails(get(metadata, "avatar")),
        thumbnailsFrom(
          pageHeader,
          "image.decoratedAvatarViewModel.avatar.avatarViewModel.image",
          "image.contentPreviewImageViewModel.image",
        ),
        thumbnails(get(legacyHeader, "avatar")),
      ),
      banner: firstNonEmpty(
        thumbnailsFrom(pageHeader, "banner.imageBannerViewModel.image"),
        thumbnails(get(legacyHeader, "banner")),
      ),
      subscriberCount: parseCount(subscriberCountText),
      subscriberCountText,
      videoCount: parseCount(videoCountText),
      videoCountText,
      viewCount: parseCount(viewCountText),
      viewCountText,
      joinedDateText: textAt(aboutView, "joinedDateText"),
      country: getString(aboutView, "country"),
      keywords: (getString(metadata, "keywords") ?? "")
        .split(/\s+/)
        .filter((keyword) => keyword.length > 0),
      tags: getArray(microformat, "tags").filter(
        (tag): tag is string => typeof tag === "string",
      ),
      links: externalLinks(aboutView),
      isFamilySafe: getBoolean(metadata, "isFamilySafe"),
      isVerified:
        isVerified(get(legacyHeader, "badges")) ||
        isVerified(get(pageHeader, "title")),
    } satisfies ChannelDetails;
  });
