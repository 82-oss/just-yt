---
title: Session options
label: Session
description: Understand anonymous visitor data, Proof-of-Origin tokens, local session generation, bootstrap fallbacks, and their limits.
group: Configuration
order: 3
---

Most applications should let `just-yt` create its anonymous session. The
options on this page exist for controlled deployments and diagnosis, not as
required setup.

## Visitor data and PO tokens

```ts
const yt = new YouTube({
  visitorData: savedVisitorData,
  poToken: currentPoToken,
});
```

`visitorData` is an anonymous session identity. Reusing valid visitor data can
make calls more consistent. `poToken` is a Proof-of-Origin token used on
endpoints that check it.

These values do not sign in a user. They do not bypass bot detection,
age-gates, private access, member restrictions, or regional restrictions.
YouTube can still refuse a request.

## Choose how bootstrap behaves

| Option | Default | Why you might change it |
| --- | --- | --- |
| `generateSessionLocally` | `false` | Skip the remote session bootstrap for faster, less faithful startup. |
| `failFast` | `false` | Refuse to start when remote session data cannot be retrieved instead of using fallback data. |
| `retrieveInnertubeConfig` | `true` | Skip fetching the remote Innertube configuration in a specialized environment. |

Local generation is useful in a test or network environment where the
bootstrap endpoint is known to be unavailable. It does not make requests more
authenticated or less subject to access controls.

`failFast: true` is useful when consistency matters more than availability. A
job can stop immediately rather than continue with locally generated session
data.

:::warning{title="Do not treat tokens as permanent credentials"}
Visitor data and PO tokens can expire or stop being accepted. Store and rotate
them according to the system that supplied them, and never present them as a
guaranteed access mechanism.
:::
