# just-yt docs

Documentation site for the just-yt TypeScript SDK, built with Astro. It lives in
the SDK repository so the public API and its documentation can change together.

## Commands

```sh
pnpm install
pnpm docs:dev
pnpm docs:build
pnpm --filter just-yt-docs preview
```

## Adding a page

Drop a markdown file in `src/content/docs/`. The sidebar, prev/next pager, and
search index all derive from the collection, so nothing else needs editing.

```md
---
title: Configuration            # <h1>, sidebar, pager and <title>; body starts at ##
description: One-line summary.  # lead paragraph + meta description
group: Documentation            # sidebar section — see GROUP_ORDER in src/lib/docs.ts
order: 3                        # position within the group
---
```

There is no overview page — `/` redirects to `/docs/getting-started`, which
carries the introduction. The sidebar and previous/next navigation are derived
from the content collection.

## Theming

Colours and scale live in `src/styles/tokens.css` — dark is the default, and
`:root[data-theme='light']` overrides it. The palette is black and white; the
accent is the same rose red used for keywords in the syntax theme
(`src/lib/code-theme.mjs`), which is a Vercel-style theme built here rather than
pulled from Shiki's bundle.

Component styles are scoped to their own `.astro` files; `src/styles/global.css`
holds only the reset, prose, and markdown styles. Fonts (Inter and JetBrains
Mono) are self-hosted through Astro's `fonts` config.
