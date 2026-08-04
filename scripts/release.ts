import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Data, Effect } from "effect";

type ReleaseType = "patch" | "minor" | "major";

class ReleaseError extends Data.TaggedError("ReleaseError")<{
  message: string;
  cause?: unknown;
}> {}

const root = process.cwd();
const changesDir = join(root, ".changes");
const packagePath = join(root, "package.json");
const changelogPath = join(root, "CHANGELOG.md");
const dryRun = process.argv.includes("--dry-run");

const read = (path: string) =>
  Effect.tryPromise({
    try: () => readFile(path, "utf8"),
    catch: (cause) => new ReleaseError({ message: `Could not read ${path}`, cause })
  });

const write = (path: string, contents: string) =>
  Effect.tryPromise({
    try: () => writeFile(path, contents),
    catch: (cause) => new ReleaseError({ message: `Could not write ${path}`, cause })
  });

const remove = (path: string) =>
  Effect.tryPromise({
    try: () => rm(path, { force: true }),
    catch: (cause) => new ReleaseError({ message: `Could not remove ${path}`, cause })
  });

const command = (name: string, args: string[]) =>
  Effect.try({
    try: () => execFileSync(name, args, { cwd: root, encoding: "utf8", stdio: "pipe" }).trim(),
    catch: (cause: unknown) => new ReleaseError({ message: `Command failed: ${name} ${args.join(" ")}`, cause })
  });

const bump = (version: string, type: ReleaseType) => {
  const [major, minor, patch] = version.split(".").map(Number);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

const rank: Record<ReleaseType, number> = { patch: 1, minor: 2, major: 3 };

const program = Effect.gen(function* () {
  const files = (yield* Effect.tryPromise({
    try: () => readdir(changesDir),
    catch: (cause) => new ReleaseError({ message: "Could not read .changes", cause })
  })).filter((file) => file.endsWith(".md") && file !== "README.md");

  if (files.length === 0) {
    yield* Effect.sync(() => console.log("No pending changesets; nothing to release."));
    return;
  }

  const changes = yield* Effect.forEach(files, (file) =>
    Effect.gen(function* () {
      const source = yield* read(join(changesDir, file));
      const match = source.match(
        /^---\s*\n(?:type|release):\s*(patch|minor|major)\s*\n---\s*\n([\s\S]*)$/
      );
      if (!match) {
        return yield* Effect.fail(new ReleaseError({ message: `Invalid changeset format: .changes/${file}` }));
      }
      return { file, type: match[1] as ReleaseType, summary: match[2].trim() };
    })
  );

  const packageJson = JSON.parse(yield* read(packagePath)) as { name: string; version: string };
  const type = changes.reduce<ReleaseType>(
    (highest, change) => rank[change.type] > rank[highest] ? change.type : highest,
    "patch"
  );
  const version = bump(packageJson.version, type);
  const tag = `v${version}`;
  const date = new Date().toISOString().slice(0, 10);
  const entry = `## ${version} — ${date}\n\n${changes.map((change) => `- ${change.summary}`).join("\n")}\n\n`;
  const existing = yield* read(changelogPath).pipe(
    Effect.catchTag("ReleaseError", () => Effect.succeed("# Changelog\n"))
  );

  yield* Effect.sync(() => console.log(`Preparing ${tag} (${type}) from ${files.length} changeset(s).`));
  if (dryRun) return;

  yield* write(packagePath, `${JSON.stringify({ ...packageJson, version }, null, 2)}\n`);
  yield* write(changelogPath, `${existing.trimEnd()}\n\n${entry}`.replace("# Changelog\n\n\n", "# Changelog\n\n"));
  yield* Effect.forEach(changes, (change) => remove(join(changesDir, change.file)));

  yield* command("pnpm", ["build"]);
  yield* command("git", ["add", "package.json", "CHANGELOG.md", ".changes"]);
  yield* command("git", ["commit", "-m", `chore(release): ${tag}`]);
  yield* command("git", ["tag", tag]);
  yield* command("git", ["push", "origin", "main", "--follow-tags"]);
  yield* command("pnpm", ["publish", "--no-git-checks"]);

  const releaseNotes = join(root, `.release-notes-${version}.md`);
  yield* write(releaseNotes, entry);
  yield* command("gh", ["release", "create", tag, "--title", tag, "--notes-file", releaseNotes]);
  yield* remove(releaseNotes);
  yield* Effect.sync(() => console.log(`Released ${tag}.`));
});

Effect.runPromise(program).catch((error) => {
  if (error instanceof ReleaseError) {
    console.error(error.message, error.cause ?? "");
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
