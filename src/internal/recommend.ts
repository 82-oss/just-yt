/**
 * Feed assembly: merge, score, diversify.
 *
 * Everything here is pure. Candidates come in from the network layer already
 * extracted; what happens to them after that is ordinary data manipulation and
 * is tested without touching YouTube.
 *
 * There is no logged-out home feed to fetch — YouTube answers `FEwhat_to_watch`
 * with a "start watching to build your feed" placeholder — so a feed has to be
 * built from seeds the caller supplies. That makes the ranking below the whole
 * product, not a detail.
 */

import type { FeedItem, FeedItemSource, RecommendedFeed } from "../domain.js";
import type { RawFeedItem } from "./extract/feed.js";

/**
 * How much to trust each endpoint.
 *
 * Measured rather than guessed: a `RDMM` radio queue seeded from a video is
 * YouTube's own content-similarity stream and returns markedly more on-topic
 * results than the watch page sidebar, which mixes in globally popular videos
 * unrelated to the seed. Uploads are exactly what the caller asked for but say
 * nothing about relevance beyond the channel. Search matches words, not topics.
 */
const SOURCE_WEIGHT: Record<FeedItemSource["via"], number> = {
  mix: 1,
  related: 0.9,
  uploads: 0.85,
  search: 0.75,
};

/**
 * Each source returns its own results in relevance order, so position is real
 * signal. Decay is gentle — the 20th item is still worth ~40% of the first.
 */
const positionDecay = (rank: number): number => 1 / (1 + rank * 0.08);

export interface Candidate {
  readonly item: RawFeedItem;
  readonly source: FeedItemSource;
  /** Zero-based position within the source that produced it. */
  readonly rank: number;
  readonly seedWeight: number;
}

export interface AssembleOptions {
  readonly limit: number;
  readonly maxPerChannel: number;
  /** Video ids to keep out of the feed, normally the video seeds themselves. */
  readonly exclude: ReadonlySet<string>;
}

export const scoreOf = (candidate: Candidate): number =>
  candidate.seedWeight *
  SOURCE_WEIGHT[candidate.source.via] *
  positionDecay(candidate.rank);

/**
 * Fills gaps in `base` from `next`.
 *
 * The same video arrives from different endpoints carrying different fields —
 * a mix queue has no view count, a sidebar lockup has no description — so
 * merging keeps whichever source happened to know a given field.
 */
const mergeItem = (base: RawFeedItem, next: RawFeedItem): RawFeedItem => ({
  ...base,
  author: base.author ?? next.author,
  durationSeconds: base.durationSeconds ?? next.durationSeconds,
  durationText: base.durationText ?? next.durationText,
  viewCount: base.viewCount ?? next.viewCount,
  viewCountText: base.viewCountText ?? next.viewCountText,
  publishedText: base.publishedText ?? next.publishedText,
  thumbnails: base.thumbnails.length > 0 ? base.thumbnails : next.thumbnails,
  isLive: base.isLive || next.isLive,
});

/**
 * Collapses candidates into a ranked feed.
 *
 * Scores from every source that produced an item are summed, so a video two
 * unrelated seeds both point at outranks one that only a single seed found.
 * That consensus effect is the main defence against a single noisy source.
 */
export const assembleFeed = (
  candidates: ReadonlyArray<Candidate>,
  options: AssembleOptions,
): RecommendedFeed["items"] => {
  const merged = new Map<
    string,
    { item: RawFeedItem; sources: FeedItemSource[]; score: number }
  >();

  for (const candidate of candidates) {
    const id = candidate.item.id;
    if (options.exclude.has(id)) continue;

    const existing = merged.get(id);
    const score = scoreOf(candidate);

    if (existing === undefined) {
      merged.set(id, {
        item: candidate.item,
        sources: [candidate.source],
        score,
      });
      continue;
    }

    existing.item = mergeItem(existing.item, candidate.item);
    existing.score += score;

    // One seed reaching an item twice via the same endpoint is not consensus.
    const duplicate = existing.sources.some(
      (source) =>
        source.seed === candidate.source.seed &&
        source.via === candidate.source.via,
    );
    if (!duplicate) existing.sources.push(candidate.source);
  }

  const ranked = [...merged.values()]
    .map(
      (entry): FeedItem => ({
        ...entry.item,
        sources: entry.sources,
        score: Math.round(entry.score * 1_000) / 1_000,
      }),
    )
    // Ties break on id so a feed built from the same candidates is stable.
    .sort((a, b) => b.score - a.score || (a.id < b.id ? -1 : 1));

  // Without a per-channel cap one prolific channel crowds out everything else,
  // which is how a recommendation feed turns into a channel feed.
  const perChannel = new Map<string, number>();
  const items: FeedItem[] = [];

  for (const item of ranked) {
    if (items.length >= options.limit) break;

    const channel = item.author?.id ?? item.author?.name;

    if (channel !== undefined) {
      const seen = perChannel.get(channel) ?? 0;
      if (seen >= options.maxPerChannel) continue;
      perChannel.set(channel, seen + 1);
    }

    items.push(item);
  }

  return items;
};
