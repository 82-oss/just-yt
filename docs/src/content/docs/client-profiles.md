---
title: Client profiles
label: Profiles
description: Learn what predefined YouTube client identities are, why endpoint fallbacks exist, and when an explicit profile is useful.
group: Configuration
order: 5
---

A client profile describes a known kind of YouTube application, such as web,
iOS, or an embedded TV client. It bundles a client name, version, user agent,
headers, and public Innertube API key.

It is not a generated API key, user account, or authentication credential.

## Keep the default first

The default profile is `WEB`. For player metadata, the SDK can try a small set
of endpoint-appropriate fallbacks when one client identity is refused.

Most applications should leave `client` unset so that built-in behavior can do
its job.

## Override only for a reason

You can choose a default for one client instance:

```ts
import { YouTube, type ClientType } from 'just-yt';

const client: ClientType = 'IOS';
const yt = new YouTube({ client });
```

Or override a single video or transcript call:

```ts
const video = await yt.video('dQw4w9WgXcQ', {
  client: 'TV_EMBEDDED',
});
```

A per-call override is useful while diagnosing an endpoint-specific response or
when a controlled integration has tested a particular profile. When you force
one profile, the normal player fallback chain is not used for that call.

## What a profile cannot promise

Different identities can receive different response shapes or playability
decisions, but no profile guarantees access. It cannot make private content
public or bypass age, member, regional, and anti-abuse controls.

Use the exported `CLIENT_TYPES` list and `ClientType` type rather than inventing
profile names. The exact exports are listed in the [API reference](/docs/api).
