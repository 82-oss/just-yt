---
title: Transcripts
label: Transcripts
description: Read published captions as clean text, select a language, request timestamped segments, and handle missing tracks.
group: Features
order: 3
---

Transcripts come from caption tracks published for a video. They are useful for
search, analysis, summaries, and accessibility workflows.

## Read the complete text

```ts
const transcript = await yt.transcript('dQw4w9WgXcQ');

transcript.title; // 'Rick Astley - Never Gonna Give You Up (Official Video)'
transcript.data; // "We're no strangers to love You know the rules and I've been…"
```

By default, `data` is one whitespace-normalized paragraph. The SDK removes
caption line breaks and YouTube's `>>` speaker markers. It prefers a
human-written track, then falls back to an auto-generated track.

## Ask for a language

Use a language code or the displayed track name:

```ts
const spanish = await yt.transcript('dQw4w9WgXcQ', {
  language: 'es',
});

spanish.title; // 'Rick Astley - Never Gonna Give You Up (Official Video)'
spanish.data; // Spanish caption text as one normalized paragraph
```

If no matching track exists, the Promise rejects with `NotFoundError`. The
message lists the available tracks, which is useful for logging or a language
picker.

## Keep timestamps

Set `segmented: true` when your application needs to connect text to playback:

```ts
const transcript = await yt.transcript('dQw4w9WgXcQ', {
  segmented: true,
});

transcript.data[0]; // { start: 18.0, end: 21.5, text: "We're no strangers to love" }

for (const segment of transcript.data) {
  console.log(segment.start, segment.end, segment.text);
}
```

`start` and `end` are numbers. Each segment's `text` is normalized to one line.
Segmented output is useful for subtitles, chapters, or links to a moment;
complete text is simpler for full-document analysis.

## Read several transcripts

```ts
const results = await yt.transcripts(videoIds, {
  language: 'en',
  segmented: true,
  concurrency: 2,
});

results[0].ok; // true
results[0].value.data[0].text; // first caption line when captions exist
```

Each missing caption track becomes a failed item without discarding successful
transcripts. A video being playable does not guarantee that it has captions.
