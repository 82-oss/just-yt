---
title: Network and retries
label: Network
description: Set timeouts and retries, supply a proxy or custom fetch implementation, and avoid accidentally multiplying retry policies.
group: Configuration
order: 4
---

Network options control how requests leave your application and how long the
SDK keeps trying when a temporary failure occurs.

## Timeouts and retries

```ts
const youtube = new YouTube({
  timeoutMillis: 10_000,
  retries: 4,
});
```

`timeoutMillis` applies to each request and defaults to `20_000`. `retries`
controls retry attempts for transient failures and defaults to `2`.

Set `retries: 0` when a queue, job runner, or outer service already owns the
retry policy. Layered retries multiply: four outer attempts around four inner
attempts can turn a short outage into a long wait.

## Use a forward proxy

Node.js and Bun can route the entire client session through an HTTP or HTTPS
forward proxy:

```ts
const youtube = new YouTube({
  proxy: process.env.YOUTUBE_PROXY_URL,
});
```

Keep credentials in an environment variable rather than source control. The
SDK reuses one proxy agent on Node.js and disposes it with `youtube.close()`.
Bun uses its native proxy transport. Other runtimes reject this option rather
than silently sending requests directly.

A proxy can match your deployment's required network route. It does not bypass
YouTube access controls or guarantee availability. Only `http:` and `https:`
proxy URLs are accepted; `socks:` is not supported.

## Supply custom fetch

A standard fetch-compatible function is useful for tests, tracing, or a
runtime-specific transport:

```ts
const youtube = new YouTube({
  fetch: async (input, init) => {
    const startedAt = Date.now();

    try {
      return await fetch(input, init);
    } finally {
      console.log(String(input), `${Date.now() - startedAt}ms`);
    }
  },
});
```

`fetch` and `proxy` cannot be set together because each controls the complete
transport. `userAgent` is also available for requests that do not require a
client-specific value, but most applications should keep the generated desktop
default.
