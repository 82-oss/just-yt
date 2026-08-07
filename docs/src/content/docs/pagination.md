---
title: Pagination
label: Pagination
description: Read search results one page at a time, use a convenient limit for small jobs, and save continuation tokens for larger ones.
group: Core Concepts
order: 3
---

YouTube does not send every search result at once. It sends a page and, when
more results exist, a continuation token that points to the next page.

## Let limit do the simple work

For a known, modest number of results, set `limit`:

```ts
const page = await youtube.search('typescript tutorial', {
  type: 'video',
  limit: 25,
});
```

The SDK follows continuation tokens until it collects 25 results or the feed
ends. The final page may contain fewer results than requested.

## Take control for longer jobs

Omit `limit` to fetch one page. Pass the returned token back unchanged:

```ts
let continuation: string | undefined;

do {
  const page = await youtube.search('web development', {
    type: 'video',
    continuation,
  });

  await saveResults(page.results);
  continuation = page.continuation;
  await saveCheckpoint(continuation);
} while (continuation);
```

This pattern lets a job save each page before requesting the next one. If the
process stops, your application has a checkpoint rather than one large,
unfinished in-memory result.

## Treat tokens as opaque

Opaque means “use it without looking inside.” Do not parse, edit, or construct
continuation tokens. They belong to YouTube's result feed and may expire.

Store the original query and filters alongside a checkpoint. A durable importer
should be able to start a fresh search when a saved token no longer works.

:::tip{title="Choose the simplest approach that fits"}
Use `limit` for a small report. Use manual pagination when you need checkpoints,
page-by-page persistence, or an open-ended import.
:::
