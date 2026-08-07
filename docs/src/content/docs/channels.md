---
title: Channels
label: Channels
description: Resolve a channel ID, handle, or URL and work with public channel identity, counts, artwork, and links.
group: Features
order: 4
---

Use `channel()` when you need the public profile behind a video or search
result.

## Choose any common target form

```ts
const fromHandle = await yt.channel('@veritasium');
const fromId = await yt.channel('UC...');
const fromUrl = await yt.channel('https://www.youtube.com/@veritasium');
```

A channel ID begins with `UC`. A handle begins with `@`. Passing either form
directly is clearer than extracting it yourself.

## Read public details

```ts
const channel = await yt.channel('@veritasium');

channel.title; // 'Veritasium'
channel.handle; // '@veritasium'
channel.subscriberCountText; // '21.1M subscribers'
channel.links[0]; // { title: 'Elements of Truth - The Game', url: 've42.co/YTBio' }
```

The result can include thumbnails, a banner, subscriber and video counts,
country, keywords, profile links, and verification status. Some fields are
optional because channels can hide them or YouTube may omit them.

Use numeric fields such as `subscriberCount` for calculations. Use display
fields such as `subscriberCountText` when you want wording formatted by
YouTube—for example, a compact localized count.

## Read several channels

```ts
const results = await yt.channels(
  ['@veritasium', '@Computerphile', 'UC...'],
  { concurrency: 2 },
);

for (const result of results) {
  if (result.ok) console.log(result.value.title);
  // → 'Veritasium', 'Computerphile', …
  else console.warn(result.target, result.error._tag);
}
```

The result order matches the target order. Use the plural method for imports so
one invalid handle does not reject every other channel.
