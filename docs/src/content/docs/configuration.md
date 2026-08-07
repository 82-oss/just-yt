---
title: Configuration
description: Configure locale, sessions, proxies, timeouts, retries, client identities, Proof-of-Origin tokens, and custom fetch behavior.
group: Documentation
order: 3
---

Every constructor option is optional. Start with `new YouTube()` and add an
option only when your application needs it.

```ts
import { YouTube } from 'just-yt';

const youtube = new YouTube({
  lang: 'en',
  location: 'ZA',
  timezone: 'Africa/Johannesburg',
  timeoutMillis: 30_000,
  retries: 3,
});
```

## Options

| Option | Type | Default | What it changes |
| --- | --- | --- | --- |
| `lang` | `string` | `'en'` | YouTube interface language (`hl`). This can change translated labels and search results. |
| `location` | `string` | `'US'` | Two-letter region (`gl`) used for regional results and availability. |
| `timezone` | `string` | Host timezone | IANA timezone such as `'Europe/London'`. |
| `userAgent` | `string` | Random desktop user agent | User agent for requests that do not require a client-specific value. |
| `client` | `ClientType` | `'WEB'` | Default predefined YouTube client profile. |
| `visitorData` | `string` | Generated | Persistent anonymous session identity for more consistent calls. |
| `poToken` | `string` | None | Proof-of-Origin token used on endpoints that check it. |
| `enableSafetyMode` | `boolean` | `false` | Enables restricted mode in the request context. |
| `generateSessionLocally` | `boolean` | `false` | Skips session bootstrap and synthesizes anonymous session data locally. |
| `failFast` | `boolean` | `false` | Fails if remote session setup fails instead of using local fallback data. |
| `retrieveInnertubeConfig` | `boolean` | `true` | Retrieves YouTube's Innertube configuration during session setup. |
| `fetch` | `FetchFn` | `globalThis.fetch` | Replaces the network implementation. Cannot be combined with `proxy`. |
| `proxy` | `string \| URL` | None | Node.js HTTP or HTTPS forward-proxy URL used for every request in the client session. |
| `timeoutMillis` | `number` | `20_000` | Per-request timeout in milliseconds. |
| `retries` | `number` | `2` | Retry attempts for transient failures. |

## Locale and region

Language and location influence what YouTube returns; they do not translate the
SDK's property names.

```ts
const youtube = new YouTube({
  lang: 'es',
  location: 'ES',
  timezone: 'Europe/Madrid',
});
```

Counts remain numbers where YouTube exposes a machine-readable value. Display
fields such as `viewCountText` or `joinedDateText` may follow the configured
language.

## Timeouts and retries

Each request has its own timeout. Transient transport and upstream failures are
retried according to `retries`.

```ts
const youtube = new YouTube({
  timeoutMillis: 10_000,
  retries: 4,
});
```

Set `retries: 0` when a queue, job runner, or outer service already controls
retries. Layering several retry policies can turn a short failure into a long
wait.

## Proxy

In Node.js, pass an HTTP or HTTPS forward-proxy URL directly. Credentials are
supported through standard URL authentication syntax and should be supplied by
an environment variable, not committed to source control.

```ts
const youtube = new YouTube({
  proxy: process.env.YOUTUBE_PROXY_URL,
});
```

The SDK creates one proxy agent lazily and reuses it until `youtube.close()`.
That keeps session setup, player metadata, and caption downloads on the same
egress identity. Proxy URLs using other protocols, including `socks:`, are
rejected explicitly. A proxy can improve compatibility with an upstream
network, but it does not bypass YouTube access controls or guarantee playback.

## Custom fetch

Pass any implementation with the standard fetch signature. A wrapper is useful
for logging, tests, or a runtime-specific transport. `fetch` and `proxy` cannot
be configured together because each controls the complete HTTP transport.

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

## Session identity

Each `YouTube` instance owns one session containing locale, visitor data, client
configuration, and network settings. Reuse the instance so those values remain
consistent between requests.

Supplying previously issued `visitorData` can make anonymous calls more
consistent. A `poToken` can improve compatibility where YouTube expects one:

```ts
const youtube = new YouTube({
  visitorData: savedVisitorData,
  poToken: currentPoToken,
});
```

These values do not authenticate a user and do not bypass bot detection,
age-gates, regional restrictions, or private access. YouTube can still refuse a
request.

## Client profiles

`ClientType` represents predefined YouTube request profiles, not API keys or
user accounts. The SDK chooses endpoint-appropriate profiles and tries a small
fallback chain for video playback metadata.

Most applications should leave `client` unset. If you are diagnosing an
endpoint-specific response, you can choose one globally or override it for a
video or transcript call:

```ts
import { YouTube, type ClientType } from 'just-yt';

const client: ClientType = 'IOS';
const youtube = new YouTube({ client });

const video = await youtube.video('dQw4w9WgXcQ', { client: 'TV_EMBEDDED' });
```

See the [API reference](/docs/api) for the exported `CLIENT_TYPES` list and the
complete option types.
