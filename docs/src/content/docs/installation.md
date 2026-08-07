---
title: Installation
label: Install
description: Check your runtime, install just-yt with Bun, pnpm, or npm, and confirm that TypeScript can find the package.
group: Start Here
order: 2
---

Before writing code, make sure you have a JavaScript runtime and a project. A
runtime is the program that executes your TypeScript or JavaScript.

## What you need

`just-yt` needs the standard `fetch`, `URL`, and `Response` APIs. Node.js 18 or
newer, Bun, Deno, and modern edge runtimes provide them. The examples use
TypeScript, but the package also works from modern JavaScript.

If you are starting from an empty folder, create a package file first:

:::tabs
```bash title="Bun"
bun init
```

```bash title="pnpm"
pnpm init
```

```bash title="npm"
npm init -y
```
:::

## Install the package

Choose the package manager your project already uses. You only need one of
these commands.

:::tabs
```bash title="Bun"
bun add just-yt
```

```bash title="pnpm"
pnpm add just-yt
```

```bash title="npm"
npm install just-yt
```
:::

The package includes its own TypeScript declarations. Do not install a separate
`@types/just-yt` package.

## Confirm the import

Create a small file and ask TypeScript to resolve the import:

```ts title="check.ts"
import { YouTube } from 'just-yt';

const youtube = new YouTube();
console.log(youtube);
await youtube.close();
```

If your editor recognizes `YouTube`, installation is complete. If it does not,
check that the terminal command ran in the same folder as your `package.json`
and restart the editor's TypeScript service.

You do not need an API key, environment variable, or Google Cloud account.
Continue to [your first request](/docs/quickstart).
