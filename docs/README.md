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

There is no overview page. The first doc in reading order is served at `/`
itself by `src/pages/index.astro`; every other doc lives under `/docs/`. That
doc is named by `HOME_DOC_ID` in `src/lib/docs.ts`, and the build fails if a
reordering leaves the constant pointing somewhere else.

## Authoring

Beyond standard Markdown, `src/lib/markdown-plugins.mjs` adds three things.

**Callouts.** `:::note`, `:::tip`, `:::warning`, `:::caution` and `:::danger`,
with an optional `{title="…"}`. A plain `>` blockquote renders as an untitled
note — these docs use blockquotes as asides, never as quotations.

**Code titles.** A `title=` on the fence adds a caption bar:

````md
```ts title="src/index.ts"
````

**Tabs.** Wrap a run of fences in `:::tabs` to collapse alternatives into one
tabbed block; each fence's `title=` becomes its tab label. Groups offering the
same set of labels stay in sync, and the choice is remembered across pages.

````md
:::tabs
```bash title="npm"
npm install just-yt
```

```bash title="pnpm"
pnpm add just-yt
```
:::
````

Every code block gets a copy button; the behaviour lives in
`src/components/CodeChrome.astro`.

## Theming

Colours and scale live in `src/styles/tokens.css` — dark is the default, and
`:root[data-theme='light']` overrides it. The interface is monochrome: the
accent is the foreground colour, so emphasis comes from contrast and weight.
Two things are allowed colour — code blocks, which keep the Vercel-style syntax
theme built in `src/lib/code-theme.mjs` rather than pulled from Shiki's bundle,
and the `--tone-*` callout hues, where the colour carries the meaning.

Component styles are scoped to their own `.astro` files; `src/styles/global.css`
holds only the reset, prose, and markdown styles. Fonts (Inter and JetBrains
Mono) are self-hosted through Astro's `fonts` config.

One scoping gotcha: a class passed to `<Icon>` as a prop does not receive the
parent's `data-astro-cid` attribute, because Astro only stamps elements written
in that file's own template. Style those with `:global()` anchored to a scoped
ancestor — see `SidebarNav.astro` for the pattern.

## Layout

The sidebar is permanent above 1000px and cannot be collapsed. Below that it
becomes a drawer driven by `<html data-drawer>`; the state is deliberately not
persisted, since reopening it on the next page load would be a bug rather than a
convenience.
