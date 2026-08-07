---
title: Search and suggestions
label: Search
description: Search YouTube, narrow results with filters, safely read mixed result types, and request autocomplete suggestions.
group: Features
order: 1
---

Search is often the entry point to a project: find public resources first, then
use their IDs with the more detailed video and channel methods.

## Run a basic search

```ts
const page = await youtube.search('learn typescript');

for (const result of page.results) {
  console.log(result.title, result.url);
}
```

A page can contain videos, channels, and playlists. Fields shared by every
result, such as `title` and `url`, can be read directly.

## Narrow mixed result types

The `type` field tells TypeScript which shape you have:

```ts
for (const result of page.results) {
  if (result.type === 'video') {
    console.log(result.durationText, result.viewCount);
  } else if (result.type === 'channel') {
    console.log(result.handle, result.subscriberCountText);
  } else {
    console.log(result.videoCount);
  }
}
```

This check is called narrowing. It prevents code from asking a channel for a
video-only property.

## Add filters with a purpose

```ts
const page = await youtube.search('learn typescript', {
  type: 'video',
  uploadDate: 'month',
  duration: 'medium',
  sortBy: 'view_count',
  features: ['hd', 'subtitles'],
  limit: 25,
});
```

| Option | Question it answers |
| --- | --- |
| `type` | Do you want videos, channels, playlists, movies, or shorts? |
| `uploadDate` | How recently should it have been uploaded? |
| `duration` | Should videos be short, medium, or long? |
| `sortBy` | Should relevance, rating, upload date, or view count lead? |
| `features` | Must results have subtitles, HD, live, 4K, HDR, or another feature? |
| `limit` | Roughly how many results should the SDK collect? |

YouTube may occasionally include an unexpected renderer even with a type
filter, so still check `result.type` before reading type-specific properties.

## Autocomplete a partial query

Suggestions are simple strings:

```ts
const suggestions = await youtube.suggestions('type scr');

for (const suggestion of suggestions) {
  console.log(suggestion);
}
```

They use the client's language and location. See [locale and region](/docs/locale-and-region)
when suggestions or search results should reflect a particular audience.
