import type { AuthorRef, Thumbnail } from "../../domain.js";
import {
  findAll,
  get,
  getArray,
  getString,
  isObject,
  parseCount,
  text,
  textAt,
  thumbnails,
} from "../json.js";

export const videoUrl = (id: string): string =>
  `https://www.youtube.com/watch?v=${id}`;

export const channelUrl = (id: string): string =>
  `https://www.youtube.com/channel/${id}`;

export const playlistUrl = (id: string): string =>
  `https://www.youtube.com/playlist?list=${id}`;

/** Reads badge labels from either the legacy renderer or the view-model form. */
export const badgeLabels = (node: unknown): ReadonlyArray<string> =>
  findAll(node, "metadataBadgeRenderer")
    .flatMap((badge) => {
      const label = getString(badge, "label") ?? getString(badge, "style");
      return label === undefined ? [] : [label];
    })
    .concat(
      findAll(node, "badgeViewModel").flatMap((badge) => {
        const label = getString(badge, "text") ?? getString(badge, "type");
        return label === undefined ? [] : [label];
      }),
    );

export const isVerified = (node: unknown): boolean =>
  badgeLabels(node).some(
    (label) =>
      label.includes("VERIFIED") ||
      label === "Verified" ||
      label.includes("OFFICIAL_ARTIST"),
  );

/** Pulls a `@handle` out of a canonical channel URL like `/@LinusTechTips`. */
export const handleFromUrl = (url: string | undefined): string | undefined => {
  if (url === undefined) return undefined;
  const match = url.match(/\/(@[\w.\-]+)/);
  return match?.[1];
};

/**
 * Builds an author reference from the owner fields on a list renderer.
 *
 * YouTube spreads these across several sibling keys and renames them
 * periodically, so each field is tried in a few places.
 */
export const authorFromRenderer = (node: unknown): AuthorRef | undefined => {
  const owner =
    get(node, "ownerText") ??
    get(node, "longBylineText") ??
    get(node, "shortBylineText");

  const name = text(owner);

  const browseId =
    getString(owner, "runs.0.navigationEndpoint.browseEndpoint.browseId") ??
    getString(node, "channelId") ??
    getString(
      node,
      "shortBylineText.runs.0.navigationEndpoint.browseEndpoint.browseId",
    );

  const canonicalUrl =
    getString(
      owner,
      "runs.0.navigationEndpoint.browseEndpoint.canonicalBaseUrl",
    ) ??
    getString(
      node,
      "shortBylineText.runs.0.navigationEndpoint.browseEndpoint.canonicalBaseUrl",
    );

  const avatar = thumbnails(
    get(node, "channelThumbnailSupportedRenderers.channelThumbnailWithLinkRenderer.thumbnail") ??
      get(node, "channelThumbnail") ??
      get(node, "thumbnail"),
  );

  if (name === undefined && browseId === undefined) return undefined;

  return {
    id: browseId,
    name,
    handle: handleFromUrl(canonicalUrl),
    url:
      canonicalUrl !== undefined
        ? `https://www.youtube.com${canonicalUrl}`
        : browseId !== undefined
          ? channelUrl(browseId)
          : undefined,
    thumbnails: avatar,
    isVerified: isVerified(get(node, "ownerBadges")),
  };
};

/** Reads the largest available thumbnail set from anywhere in a node. */
export const thumbnailsFrom = (
  node: unknown,
  ...paths: ReadonlyArray<string>
): ReadonlyArray<Thumbnail> => {
  for (const path of paths) {
    const found = thumbnails(get(node, path));
    if (found.length > 0) return found;
  }
  return [];
};

/**
 * Extracts the first number embedded in a human-readable string, e.g.
 * `"like this video along with 1,234 other people"` → `1234`.
 */
export const embeddedNumber = (value: unknown): number | undefined => {
  const raw = typeof value === "string" ? value : text(value);
  if (raw === undefined) return undefined;

  const match = raw.match(/\d[\d,.  ]*\s*[KMB]?/i);
  if (match === null) return undefined;

  return parseCount(match[0]);
};

/** The label a duration overlay carries, e.g. `"12:34"` or `"LIVE"`. */
export const overlayTimeStatus = (
  node: unknown,
): { readonly text?: string; readonly style?: string } => {
  const overlay = getArray(node, "thumbnailOverlays")
    .map((item) => get(item, "thumbnailOverlayTimeStatusRenderer"))
    .find(isObject);

  return {
    text: textAt(overlay, "text"),
    style: getString(overlay, "style"),
  };
};
