---
title: Configuration overview
label: Overview
description: Start with no options, then learn which group of settings to reach for when your application has a specific need.
group: Configuration
order: 1
---

Every constructor option is optional. The simplest and usually best starting
point is:

```ts
const yt = new YouTube();
```

Configuration should answer a real need. UK search results need locale
options. A slow upstream may need a longer timeout. A test may need a custom
`fetch`. Adding every option at once makes problems harder to understand.

## The four questions options answer

| Question | Options | Read next |
| --- | --- | --- |
| What language and region should YouTube use? | `lang`, `location`, `timezone`, `enableSafetyMode` | [Locale and region](/docs/locale-and-region) |
| How should this anonymous session be created? | `visitorData`, `poToken`, `generateSessionLocally`, `failFast`, `retrieveInnertubeConfig` | [Session options](/docs/session-options) |
| How should requests travel and recover? | `timeoutMillis`, `retries`, `proxy`, `fetch`, `userAgent` | [Network and retries](/docs/network-and-retries) |
| Which predefined YouTube client should ask? | `client`, per-call `client` | [Client profiles](/docs/client-profiles) |

## A small, purposeful configuration

This client targets US results and gives each request 30 seconds:

```ts
import { YouTube } from 'just-yt';

const yt = new YouTube({
  location: 'US',
  timezone: 'America/New_York',
  timeoutMillis: 30_000,
});
```

The underscores in `30_000` only make the number easier to read. It is still
thirty thousand milliseconds, or thirty seconds.

## Defaults are part of the design

With no options, the SDK uses English, the US region, the Eastern US
timezone (`America/New_York`), the
`WEB` client profile, a 20-second timeout, and two retry attempts. It creates
anonymous session data and falls back to local session data when bootstrap is
unavailable.

Those defaults are intended for ordinary public-data requests. Keep them until
you can name the behavior you want to change.

:::note{title="Options belong to the client"}
Constructor options apply to every request made by that `YouTube` instance.
Create separate clients only when you truly need separate locales, sessions, or
network routes.
:::

The remaining pages explain each choice and its trade-offs. For exact property
types and defaults, use the [API reference](/docs/api).
