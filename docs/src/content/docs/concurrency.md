---
title: Concurrency
label: Concurrency
description: Process several targets at once without creating an uncontrolled request burst, while keeping results aligned with inputs.
group: Core Concepts
order: 2
---

Concurrency means how many independent targets are being processed at the same
time. It is useful when you have several video IDs, channel handles, or
transcripts to read.

## Begin with the plural method

Use `videos()` instead of manually starting many `video()` calls:

```ts
const results = await yt.videos([
  'jNQXAC9IVRw',
  'dQw4w9WgXcQ',
  'aqz-KE-bpKQ',
]);
```

Plural methods use a concurrency of `2` by default. At most two complete target
operations are active. When either finishes, the next target starts.

```text
time →     start                         finish
worker 1:  video A ────────── video C ─────────
worker 2:  video B ────────────────────────────
```

This is a moving pool, not fixed batches. Video C does not wait for both A and
B; it starts as soon as one place is free.

## Choose a limit

You can choose from `1` through `4`:

```ts
const results = await yt.videos(videoIds, { concurrency: 3 });
```

| Value | When it is useful |
| --- | --- |
| `1` | Predictable, gentle sequential work or easier debugging. |
| `2` | The balanced default for most scripts and services. |
| `3` | A little more throughput when requests are stable. |
| `4` | The maximum, for controlled jobs where speed matters. |

Higher is not automatically better. Each target may require more than one HTTP
request, so target concurrency is not the same as raw request count. More
parallel work can also meet upstream rate limits sooner.

## Results keep their order

Requests can finish out of order, but the returned array stays aligned with the
input array:

```ts
for (const [index, result] of results.entries()) {
  console.log(videoIds[index], result.target);
}
```

Each entry has `ok: true` with a `value`, or `ok: false` with an `error`. A
failed target does not erase successful ones. Read [handling errors](/docs/guides)
for the full pattern.

`channels()` and `transcripts()` use the same concurrency model.
