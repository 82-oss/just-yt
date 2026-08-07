---
title: The client and its session
label: Client
description: Understand why a YouTube client owns one anonymous session, when that session starts, and when to close it.
group: Core Concepts
order: 1
---

The `YouTube` object is more than a collection of methods. It owns the settings
and anonymous session shared by those methods.

## Construction is lazy

This line only stores configuration and prepares the client:

```ts
const yt = new YouTube({ location: 'ZA' });
```

No request happens until you call `search()`, `video()`, `transcript()`, or
another operation. The first operation initializes a session. Later operations
reuse it.

## Why reuse matters

A session keeps visitor data, locale, client configuration, cookies returned by
the service, and network settings consistent. Creating a client for every
request repeatedly performs setup and makes the caller's identity drift.

For a script, create one client near the top:

```ts
const yt = new YouTube();

try {
  const page = await yt.search('typescript tutorial');
  const details = await yt.video('jNQXAC9IVRw');
  console.log(page.results.length, details.title);
} finally {
  await yt.close();
}
```

For a server, create it outside the request handler:

```ts
const yt = new YouTube({ location: 'ZA' });

export async function GET(request: Request): Promise<Response> {
  const id = new URL(request.url).searchParams.get('id');
  if (!id) return new Response('Missing id', { status: 400 });

  return Response.json(await yt.video(id));
}
```

Close that client from your application's shutdown hook, not after every
incoming request.

## When separate clients make sense

Use separate clients when the sessions genuinely need different identities or
configuration—for example, one fixed to `location: 'ZA'` and another fixed to
`location: 'JP'`, or two distinct proxies.

Do not create extra clients merely to run work at the same time. The plural
methods already provide bounded [concurrency](/docs/concurrency) within one
consistent session.

## What close does

`await yt.close()` disposes the managed runtime and resources such as a
proxy agent. Treat a closed client as finished; create a new one if a later job
needs a new session.
