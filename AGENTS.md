# AGENTS.md

## Lessons from existing projects

- Use YouTube's internal Innertube endpoints for structured metadata, search, captions, channels, playlists, and comments; client configurations may differ by endpoint.
- Keep raw YouTube responses behind an internal transport/parser layer and expose stable, fully typed domain models to SDK users.
- Follow yt-dlp's resilience: expect undocumented response changes, support fallbacks, and model cookies, tokens, rate limits, unavailable videos, and bot detection explicitly.
- Use Effect internally for typed errors, retries, timeouts, dependency injection, and composable extraction workflows, while exposing a familiar Promise-based public API.
- Validate unstable responses before parsing and preserve continuation tokens for pagination.
- Follow YouTube.js's larger-scale patterns: isolate session/action transport from endpoint APIs, use typed parser nodes for renderer-shaped JSON, support runtime-specific adapters, and report parser drift without bringing down the whole response.
- Create one session per SDK client instance so cookies, visitor data, locale, cache, and request configuration remain consistent across calls.
- Treat client identities as predefined request profiles—not generated user keys—with their own client name, version, user-agent, headers, and public Innertube API key; different endpoints may select different profiles.
- Keep anonymous session state separate from authenticated cookies, proxies, PO tokens, and other network/access configuration; these improve compatibility but do not guarantee access or bypass anti-abuse systems.

## Git and release workflow

- Before making changes on `main`, run `git pull --ff-only` to synchronize release commits created by CI. If the worktree has local changes or the pull cannot fast-forward, stop and inspect instead of merging automatically.
- Make meaningful changes in the current branch. Small changes do not require a commit; after a significant set of changes, use a Conventional Commit message such as `feat(parser): add caption extraction` or `fix(client): handle unavailable videos`.
- Do not push unless the user explicitly asks. By default, commit and push to `main`; create and use a separate branch only when the user asks for one, and switch branches only when the user explicitly instructs it.
- Any changes pushed directly to `main` must include a `.changes/<description>.md` file with `type: patch` by default. Create a `minor` changeset only when the user requests a minor release, and a `major` changeset only when the user explicitly requests a major release.
- When preparing a PR into `main`, include a changeset with `type: minor` by default unless the user specifies another release level. The changeset must describe the user-visible change in release-note language.
- Merging to `main` triggers `.github/workflows/release.yml`. Its preparation job consumes pending changesets, updates `package.json` and `CHANGELOG.md`, builds, commits the release, and tags it. Its publication job checks out that exact tag, publishes it to npm, verifies the registry version, and then creates the GitHub Release. Publication is idempotent so a failed job can be retried without bumping again.
- Before releasing, run `pnpm release:dry`; never use `pnpm release:prepare` or `pnpm release:publish` locally unless the user explicitly asks to perform that release phase.
