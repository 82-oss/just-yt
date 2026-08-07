---
title: Welcome to just-yt
label: Welcome
description: Learn what just-yt does, what it does not do, and how the documentation will take you from a first request to a reliable application.
group: Start Here
order: 1
---

`just-yt` is a TypeScript library for reading public information from YouTube.
It can search, inspect videos and channels, read published captions as
transcripts, and return autocomplete suggestions.

You do not need a Google Cloud project or a YouTube Data API key. The library
talks to Innertube, the internal service used by YouTube's own clients, and
turns its changing responses into ordinary, typed JavaScript objects.

## Explore the SDK

Choose the kind of public YouTube data you want to work with. Each card opens a
focused guide with examples, options, and the reasons you might use them.

:::link-grid
::link-card{title="Search" href="/docs/search" icon="search" description="Find videos, channels, and playlists with familiar filters."}
::link-card{title="Videos" href="/docs/videos" icon="video" description="Read stable metadata from a video ID or URL."}
::link-card{title="Transcripts" href="/docs/transcripts" icon="transcript" description="Turn published captions into complete text or timed segments."}
::link-card{title="Channels" href="/docs/channels" icon="channel" description="Inspect public channel identity, counts, artwork, and links."}
:::

## Who this guide is for

This guide starts from the beginning. You should be able to follow it if you
know how to open a terminal and edit a TypeScript file. When a new idea appears,
we explain why it exists before showing its options.

If you already have an application, you can jump to a feature page or the
[API reference](/docs/api). The chapters are still arranged in a useful reading
order:

1. **Start Here** installs the package and makes one request.
2. **Core Concepts** explains the client, sessions, concurrency, pagination,
   and errors.
3. **Features** covers each kind of public data separately.
4. **Configuration** adds options only when there is a reason to use them.
5. **Advanced** introduces the Effect-native API.

## What you can build

Common projects include a small research script, a channel dashboard, a search
index, a transcript analysis tool, or a server that adds public YouTube details
to its own records.

The Promise API is the best place to begin:

```ts
import { YouTube } from 'just-yt';

const yt = new YouTube();
const video = await yt.video('jNQXAC9IVRw');

console.log(video.title);
```

The result is a normal object. There is no special response wrapper to learn.

## The boundary to remember

:::caution{title="Public data only"}
The library does not sign in, read private or members-only content, download
audio or video, or bypass YouTube's access controls.
:::

Innertube is undocumented and YouTube can change it. `just-yt` isolates those
changes behind typed models and clear errors, but no anonymous client can
promise that every video will always be available.

## Your next step

Continue to [installation](/docs/installation). It checks the small amount of
setup you need and explains what each install command does.
