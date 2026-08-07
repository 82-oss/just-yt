# Start with just-yt

Use this guide to add `just-yt` to the user's project safely. Do not create,
install, or modify anything until you have inspected the current directory and
received explicit confirmation for the approach you propose.

## 1. Inspect and confirm

First, inspect the current directory without changing it.

- If the directory is empty, tell the user you can scaffold a minimal Bun and
  TypeScript project here, then ask for confirmation. After they confirm, run
  `bun init -y`, install `just-yt`, and add one small example they can run.
- If a project already exists, identify its runtime and structure. Suggest the
  most natural place for a small YouTube-powered feature, explain which files
  you would change, and ask for confirmation before editing.
- If there is no clearly appropriate location, ask the user where they want the
  feature. You may offer an isolated YouTube test/example as the default, but do
  not add it until they agree.

Keep the first change small. Do not add authentication, downloads, private or
members-only access, or anti-abuse bypasses. `just-yt` is for public YouTube
metadata and captions.

## 2. Read only the documentation you need

Start with these pages, then follow a more specific page only when the chosen
feature needs it:

- [Getting started](/docs/getting-started.md)
- [Installation](/docs/installation.md)
- [Client and session](/docs/client-and-session.md)
- [Search](/docs/search.md)
- [Videos](/docs/videos.md)
- [Transcripts](/docs/transcripts.md)
- [Configuration](/docs/configuration.md)
- [Network and retries](/docs/network-and-retries.md)
- [Effect integration](/docs/effect.md)

Use the Promise API unless the existing project already uses Effect or the
user asks for it. Create one `YouTube` client and reuse it rather than creating
a client for every call.

## 3. Implement and verify

After confirmation, implement the smallest useful version, use the project's
existing conventions, and run the relevant typecheck or tests. Explain what was
added, how to run it, and any limits that affect the feature.
