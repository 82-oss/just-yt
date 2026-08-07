---
title: just-yt — typed YouTube data, without an API key
description: A TypeScript SDK for public YouTube data—search, videos, channels, transcripts, and suggestions as stable typed objects, with no Google Cloud project and no API key.
---

:::landing-hero
# Typed YouTube data, without an API key

A TypeScript SDK for public YouTube data. Search, videos, channels,
transcripts, and suggestions come back as stable typed objects, read from the
same endpoints YouTube's own clients use.

<div class="hero-onramp" data-hero-onramp>
  <div class="hero-onramp-tabs" role="tablist" aria-label="Choose how to get started">
    <button type="button" role="tab" aria-selected="true" aria-controls="hero-for-you" id="hero-for-you-tab" data-onramp-tab="you">For you</button>
    <span aria-hidden="true"></span>
    <button type="button" role="tab" aria-selected="false" aria-controls="hero-for-agent" id="hero-for-agent-tab" data-onramp-tab="agent" tabindex="-1">For your agent</button>
  </div>
  <div class="hero-onramp-panel" role="tabpanel" id="hero-for-you" aria-labelledby="hero-for-you-tab" data-onramp-panel="you">
    <span class="hero-command-prefix" aria-hidden="true">$</span>
    <code>bun add just-yt</code>
  </div>
  <div class="hero-onramp-panel hero-agent-panel" role="tabpanel" id="hero-for-agent" aria-labelledby="hero-for-agent-tab" data-onramp-panel="agent" hidden>
    <div class="hero-agent-icons" aria-hidden="true">
      <span class="hero-agent-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M17.304 3.541h-3.672l6.696 16.918H24Zm-10.608 0L0 20.459h3.744l1.37-3.553h7.005l1.369 3.553h3.744L10.536 3.541Zm-.371 10.223L8.616 7.82l2.291 5.945Z"/></svg></span>
      <span class="hero-agent-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M22.282 9.821a5.985 5.985 0 0 0-.516-4.91 6.046 6.046 0 0 0-6.51-2.9A6.065 6.065 0 0 0 4.981 4.18a5.985 5.985 0 0 0-3.998 2.9 6.046 6.046 0 0 0 .743 7.097 5.98 5.98 0 0 0 .51 4.911 6.051 6.051 0 0 0 6.515 2.9A5.985 5.985 0 0 0 13.26 24a6.056 6.056 0 0 0 5.772-4.206 5.99 5.99 0 0 0 3.997-2.9 6.056 6.056 0 0 0-.747-7.073zM13.26 22.43a4.476 4.476 0 0 1-2.876-1.04l.141-.081 4.779-2.758a.795.795 0 0 0 .392-.681v-6.737l2.02 1.168a.071.071 0 0 1 .038.052v5.583a4.504 4.504 0 0 1-4.494 4.494zM3.6 18.304a4.47 4.47 0 0 1-.535-3.014l.142.085 4.783 2.759a.771.771 0 0 0 .78 0l5.843-3.368v2.332a.08.08 0 0 1-.033.062L9.74 19.95a4.5 4.5 0 0 1-6.14-1.646zM2.34 7.896a4.485 4.485 0 0 1 2.366-1.973V11.6a.766.766 0 0 0 .388.676l5.815 3.354-2.02 1.168a.076.076 0 0 1-.071 0L3.928 13.7A4.5 4.5 0 0 1 2.34 7.872zm16.596 3.856L13.104 8.364 15.119 7.2a.076.076 0 0 1 .071 0l4.83 2.791a4.494 4.494 0 0 1-.676 8.104v-5.677a.79.79 0 0 0-.407-.667zm2.011-3.023-.142-.085-4.774-2.782a.776.776 0 0 0-.785 0L9.409 9.23V6.897a.066.066 0 0 1 .028-.061l4.83-2.787a4.5 4.5 0 0 1 6.68 4.66zM8.307 12.863l-2.02-1.164a.08.08 0 0 1-.038-.057V6.074a4.5 4.5 0 0 1 7.376-3.454l-.142.081L8.704 5.459a.795.795 0 0 0-.393.681zm1.097-2.365 2.602-1.5 2.607 1.5v2.999l-2.597 1.5-2.607-1.5z"/></svg></span>
      <span class="hero-agent-icon"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M11.503.131 1.891 5.678a.84.84 0 0 0-.42.726v11.188c0 .3.162.575.42.724l9.609 5.55a1 1 0 0 0 .998 0l9.61-5.55a.84.84 0 0 0 .42-.724V6.404a.84.84 0 0 0-.42-.726L12.497.131a1.01 1.01 0 0 0-.996 0M2.657 6.338h18.55c.263 0 .43.287.297.515L12.23 22.918c-.062.107-.229.064-.229-.06V12.335a.59.59 0 0 0-.295-.51l-9.11-5.257c-.109-.063-.064-.23.061-.23"/></svg></span>
    </div>
    <button type="button" data-copy-agent-prompt>Copy prompt</button>
    <span class="hero-copy-status" data-agent-copy-status aria-live="polite"></span>
  </div>
</div>
:::

:::landing-feature
## Fetch a video with one call

Pass an ID or any `watch`, `youtu.be`, `/shorts/`, `/embed/`, or `/live/` URL.
The client opens one Innertube session on its first request and reuses it, so
create it once and keep it for the life of your app.

```ts
import { YouTube } from 'just-yt';

const yt = new YouTube();
const video = await yt.video('jNQXAC9IVRw');

video.title; // 'Me at the zoo'
video.viewCount; // 403130789
video.channel.handle; // '@jawed'
```
:::

:::landing-feature
## Search with familiar filters

Filter by type, upload date, duration, sort order, and features such as HD or
subtitles. One results page comes back by default; set a limit and the SDK
follows YouTube's continuation tokens for you.

```ts
const page = await yt.search('effect ts', {
  type: 'video',
  uploadDate: 'week',
  sortBy: 'view_count',
  features: ['hd', 'subtitles'],
});

page.results[0].title; // 'Effect.ts Tutorial'
page.results[0].viewCount; // 128000

const many = await yt.search('effect ts', {
  limit: 100,
});
```
:::

:::landing-feature
## Transcripts, plain or timed

Captions arrive as one normalized paragraph—the shape you want for a summary
or an embedding. Ask for segments instead and each line carries its start and
end in seconds.

```ts
const text = await yt.transcript(id, {
  language: 'en',
});

text.title; // 'Rick Astley - Never Gonna Give You Up (Official Video)'
text.data; // "We're no strangers to love You know the rules and I've been…"

const timed = await yt.transcript(id, {
  segmented: true,
});

timed.data[0]; // { start: 18.0, end: 21.5, text: "We're no strangers to love" }
```
:::

:::landing-feature
## Every failure is tagged

Narrow rejections with `instanceof`, or switch on `_tag`. `ExtractionError` is
the one to watch: it means YouTube reshaped a response, and its `path` field
points at where extraction gave up.

```ts
import { NotFoundError } from 'just-yt';

try {
  await yt.transcript(id, { language: 'en' });
} catch (error) {
  if (error instanceof NotFoundError) {
    return null;
  }

  throw error;
}
```
:::

:::landing-feature
## The same SDK as an Effect service

Promises are the default and need nothing else installed. When you want errors
in the type system, together with retries, timeouts, and search as a Stream,
the service exposes the same API.

```ts
import { Effect } from 'effect';
import { YouTubeApi, layer } from 'just-yt';

const program = Effect.gen(function* () {
  const yt = yield* YouTubeApi;
  return yield* yt.video('dQw4w9WgXcQ');
});

Effect.runPromise(
  program.pipe(Effect.provide(layer())),
);
```
:::

:::landing-closing
## Install it and read something

Public metadata only: no sign-in, no downloads, and no private or members-only
content. Node 18 or newer, Bun, Deno, and modern edge runtimes are supported.

[Get started](/docs/getting-started) [View on GitHub](https://github.com/82-oss/just-yt)
:::
