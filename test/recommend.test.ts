import assert from "node:assert/strict";
import test from "node:test";
import type { FeedItemSource } from "../src/domain.js";
import type { RawFeedItem } from "../src/internal/extract/feed.js";
import { assembleFeed, scoreOf, type Candidate } from "../src/internal/recommend.js";

const item = (id: string, channel = `ch-${id}`): RawFeedItem => ({
  id,
  title: `Video ${id}`,
  url: `https://www.youtube.com/watch?v=${id}`,
  thumbnails: [],
  author: { id: channel, name: channel, thumbnails: [], isVerified: false },
  isLive: false,
});

const candidate = (
  id: string,
  via: FeedItemSource["via"],
  options: {
    readonly rank?: number;
    readonly seedWeight?: number;
    readonly seed?: string;
    readonly channel?: string;
  } = {},
): Candidate => ({
  item: item(id, options.channel),
  rank: options.rank ?? 0,
  seedWeight: options.seedWeight ?? 1,
  source: {
    seed: options.seed ?? "seed",
    kind: "video",
    via,
  },
});

const assemble = (
  candidates: ReadonlyArray<Candidate>,
  overrides: Partial<Parameters<typeof assembleFeed>[1]> = {},
) =>
  assembleFeed(candidates, {
    limit: 50,
    maxPerChannel: 3,
    exclude: new Set<string>(),
    ...overrides,
  });

test("ranks a mix above a sidebar result at the same position", () => {
  const feed = assemble([candidate("b", "related"), candidate("a", "mix")]);

  assert.deepEqual(
    feed.map((entry) => entry.id),
    ["a", "b"],
  );
});

test("position decays score within a source", () => {
  assert.ok(
    scoreOf(candidate("a", "mix", { rank: 0 })) >
      scoreOf(candidate("a", "mix", { rank: 5 })),
  );
});

test("seed weight scales a seed's contribution", () => {
  const feed = assemble([
    candidate("weak", "mix", { seedWeight: 0.1, seed: "s1" }),
    candidate("strong", "search", { seedWeight: 3, seed: "s2" }),
  ]);

  assert.equal(feed[0].id, "strong");
});

test("a zero weight keeps a seed's results out of the ranking", () => {
  const feed = assemble([
    candidate("muted", "mix", { seedWeight: 0, seed: "s1" }),
    candidate("kept", "search", { seedWeight: 1, seed: "s2" }),
  ]);

  assert.equal(feed[0].id, "kept");
  assert.equal(feed.find((entry) => entry.id === "muted")?.score, 0);
});

test("two seeds agreeing outranks a single stronger source", () => {
  const feed = assemble([
    // One top-of-list mix hit.
    candidate("solo", "mix", { rank: 0, seed: "s1" }),
    // Versus a weaker source that two different seeds both surfaced.
    candidate("agreed", "search", { rank: 1, seed: "s1" }),
    candidate("agreed", "search", { rank: 1, seed: "s2" }),
  ]);

  assert.equal(feed[0].id, "agreed");
  assert.equal(feed[0].sources.length, 2);
});

test("the same seed and source twice is not counted as agreement", () => {
  const feed = assemble([
    candidate("dupe", "related", { seed: "s1" }),
    candidate("dupe", "related", { seed: "s1" }),
  ]);

  assert.equal(feed.length, 1);
  assert.equal(feed[0].sources.length, 1);
});

test("merging fills fields the first source did not carry", () => {
  const sparse = candidate("x", "mix");
  const rich: Candidate = {
    ...candidate("x", "related"),
    item: {
      ...item("x"),
      viewCount: 1_000,
      viewCountText: "1K views",
      durationText: "10:00",
    },
  };

  const [entry] = assemble([sparse, rich]);

  assert.equal(entry.viewCount, 1_000);
  assert.equal(entry.durationText, "10:00");
});

test("excluded ids never reach the feed", () => {
  const feed = assemble([candidate("seed-video", "mix"), candidate("other", "mix")], {
    exclude: new Set(["seed-video"]),
  });

  assert.deepEqual(
    feed.map((entry) => entry.id),
    ["other"],
  );
});

test("one channel cannot exceed the per-channel cap", () => {
  const feed = assemble(
    ["a", "b", "c", "d", "e"].map((id) =>
      candidate(id, "uploads", { channel: "same-channel" }),
    ),
    { maxPerChannel: 2 },
  );

  assert.equal(feed.length, 2);
});

test("the per-channel cap does not merge distinct channels", () => {
  const feed = assemble(
    ["a", "b", "c"].map((id) => candidate(id, "uploads", { channel: `ch-${id}` })),
    { maxPerChannel: 1 },
  );

  assert.equal(feed.length, 3);
});

test("limit truncates after ranking, not before", () => {
  const feed = assemble(
    [
      candidate("low", "search", { rank: 9, channel: "c1" }),
      candidate("high", "mix", { rank: 0, channel: "c2" }),
    ],
    { limit: 1 },
  );

  assert.deepEqual(
    feed.map((entry) => entry.id),
    ["high"],
  );
});

test("ordering is stable when scores tie", () => {
  const candidates = [
    candidate("zzz", "mix", { channel: "c1" }),
    candidate("aaa", "mix", { channel: "c2" }),
  ];

  assert.deepEqual(
    assemble(candidates).map((entry) => entry.id),
    assemble([...candidates].reverse()).map((entry) => entry.id),
  );
});

test("no candidates yields an empty feed", () => {
  assert.deepEqual(assemble([]), []);
});

test("items without an author bypass the channel cap rather than colliding", () => {
  const anonymous = ["a", "b", "c"].map((id) => ({
    ...candidate(id, "search"),
    item: { ...item(id), author: undefined },
  }));

  assert.equal(assemble(anonymous, { maxPerChannel: 1 }).length, 3);
});
