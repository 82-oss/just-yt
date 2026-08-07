---
title: Your first request
label: Start
description: Create a client, fetch one public video, understand the returned object, and close the client cleanly.
group: Start Here
order: 3
---

With the package installed, you can make a real request. We will fetch one
video first because it gives us a small example with an easy-to-see result.

## Create a file

Create a file named `example.ts` and add:

```ts title="example.ts"
import { YouTube } from 'just-yt';

const yt = new YouTube();
const video = await yt.video('jNQXAC9IVRw');

console.log(video.title); // Me at the zoo
console.log(video.channel.name); // jawed
console.log(video.viewCount); // 403130789

await yt.close();
```

Run the file with your runtime:

:::tabs
```bash title="Bun"
bun run example.ts
```

```bash title="Node.js"
npx tsx example.ts
```
:::

## What each line does

`new YouTube()` creates a client. It does not contact YouTube yet. The first
method call creates a session, and later calls reuse that same session.

`yt.video(...)` accepts either an 11-character video ID or a common
YouTube URL. It returns a Promise, so `await` pauses this function until the
result is ready.

The result is a plain object. TypeScript knows that `title` is text and that a
value YouTube may omit, such as `viewCount`, can be `undefined`.

```ts
if (video.viewCount !== undefined) {
  console.log(video.viewCount.toLocaleString());
} else {
  console.log('YouTube did not provide a view count');
}
```

An absent number does not mean zero. Keeping that distinction prevents a
missing value from becoming a misleading value in your application.

## Keep the client while you work

If your script makes more requests, do them before `close()`:

```ts
const yt = new YouTube();

try {
  const video = await yt.video('jNQXAC9IVRw');
  const channel = await yt.channel(video.channel.id!);

  console.log(video.title, channel.title);
  // → Me at the zoo Veritasium
} finally {
  await yt.close();
}
```

The `finally` block runs whether the requests succeed or fail. Long-running
servers normally keep one client open and close it only during application
shutdown.

Next, learn [why one shared client matters](/docs/client-and-session), then
choose a feature such as [search](/docs/search).
