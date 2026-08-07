---
title: Locale and region
label: Locale
description: Choose the language, country, timezone, and safety mode that shape YouTube's localized public responses.
group: Configuration
order: 2
---

Locale settings tell YouTube which audience the anonymous client represents.
They can affect search ordering, translated labels, availability, and display
text. They do not translate the SDK's property names.

## Configure an audience

```ts
const yt = new YouTube({
  lang: 'en',
  location: 'US',
  timezone: 'America/New_York',
});
```

| Option | Meaning | Default |
| --- | --- | --- |
| `lang` | YouTube interface language, sent as `hl`. | `'en'` |
| `location` | Two-letter region, sent as `gl`. | `'US'` |
| `timezone` | IANA timezone used in the request context. | Host timezone |
| `enableSafetyMode` | Requests YouTube's restricted mode. | `false` |

Use an IANA timezone such as `Europe/London` or `America/New_York`, not a
short abbreviation such as `EST`. Abbreviations can be ambiguous and do not
describe daylight-saving rules.

## Machine values and display values

When YouTube exposes a machine-readable count, the SDK returns a number. A
display field such as `viewCountText` or `joinedDateText` may follow the chosen
language and region.

Prefer numbers for calculations and sorting. Prefer display text when you want
YouTube's localized presentation.

## Use separate clients for separate locales

Locale belongs to the session, so do not mutate it between calls. Create one
long-lived client per audience when an application truly needs several:

```ts
const us = new YouTube({ lang: 'en', location: 'US' });
const uk = new YouTube({ lang: 'en', location: 'GB' });
```

This keeps each session internally consistent.
