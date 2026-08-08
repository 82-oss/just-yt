import { readFile, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { Data, Duration, Effect } from "effect";

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
const prepare = process.argv.includes("--prepare") || dryRun;
const publish = process.argv.includes("--publish");

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

const commandSucceeds = (name: string, args: string[]) =>
  Effect.sync(() => {
    try {
      execFileSync(name, args, { cwd: root, stdio: "ignore" });
      return true;
    } catch {
      return false;
    }
  });

const commandEventuallySucceeds = (
  name: string,
  args: string[],
  attempts = 10,
) =>
  Effect.gen(function* () {
    for (let attempt = 1; attempt <= attempts; attempt += 1) {
      if (yield* commandSucceeds(name, args)) return true;
      if (attempt < attempts) yield* Effect.sleep(Duration.seconds(3));
    }
    return false;
  });

const bump = (version: string, type: ReleaseType) => {
  const [major, minor, patch] = version.split(".").map(Number);
  if (type === "major") return `${major + 1}.0.0`;
  if (type === "minor") return `${major}.${minor + 1}.0`;
  return `${major}.${minor}.${patch + 1}`;
};

const rank: Record<ReleaseType, number> = { patch: 1, minor: 2, major: 3 };

const compareVersionsDescending = (left: string, right: string) => {
  const leftParts = left.split(".").map(Number);
  const rightParts = right.split(".").map(Number);

  for (let index = 0; index < 3; index += 1) {
    const difference = (rightParts[index] ?? 0) - (leftParts[index] ?? 0);
    if (difference !== 0) return difference;
  }

  return 0;
};

const sortChangelog = (contents: string) => {
  const headingPattern = /^## (\d+\.\d+\.\d+)(?:\s+—.*)?$/gm;
  const matches = [...contents.matchAll(headingPattern)];
  if (matches.length < 2) return contents.trimEnd() + "\n";

  const preamble = contents.slice(0, matches[0].index).trimEnd();
  const entries = matches.map((match, index) => ({
    version: match[1],
    content: contents
      .slice(match.index, matches[index + 1]?.index ?? contents.length)
      .trim()
  }));

  entries.sort((left, right) => compareVersionsDescending(left.version, right.version));
  return `${preamble}\n\n${entries.map((entry) => entry.content).join("\n\n")}\n`;
};

const prepareRelease = Effect.gen(function* () {
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
  const notes = changes.map((change) => `- ${change.summary}`).join("\n");
  const entry = `## ${version} — ${date}\n\n${notes}\n\n`;
  const existing = yield* read(changelogPath).pipe(
    Effect.catchTag("ReleaseError", () => Effect.succeed("# Changelog\n"))
  );

  yield* Effect.sync(() => console.log(`Preparing ${tag} (${type}) from ${files.length} changeset(s).`));
  if (dryRun) return;

  const tagExists = yield* commandSucceeds("git", ["rev-parse", "--verify", `refs/tags/${tag}`]);
  if (tagExists) {
    yield* command("git", ["checkout", "--detach", tag]);
    yield* Effect.sync(() => console.log(`${tag} is already prepared; reusing the existing tag.`));
    return;
  }

  yield* write(packagePath, `${JSON.stringify({ ...packageJson, version }, null, 2)}\n`);
  yield* write(changelogPath, sortChangelog(`${existing.trimEnd()}\n\n${entry}`));
  yield* Effect.forEach(changes, (change) => remove(join(changesDir, change.file)));

  yield* command("pnpm", ["build"]);
  yield* command("git", ["add", "package.json", "CHANGELOG.md", ".changes"]);
  yield* command("git", ["commit", "-m", `chore(release): ${tag}`]);
  yield* command("git", ["tag", "--annotate", tag, "--message", tag]);
  yield* command("git", ["push", "origin", "main", tag]);
});

const publishRelease = Effect.gen(function* () {
  const packageJson = JSON.parse(yield* read(packagePath)) as { name: string; version: string };
  const { name, version } = packageJson;
  const tag = `v${version}`;
  const expectedTag = (yield* command("git", ["tag", "--points-at", "HEAD"]))
    .split("\n")
    .includes(tag);

  if (!expectedTag) {
    return yield* Effect.fail(new ReleaseError({
      message: `Refusing to publish ${name}@${version}: HEAD is not tagged ${tag}`
    }));
  }

  const alreadyPublished = yield* commandSucceeds("npm", ["view", `${name}@${version}`, "version"]);
  if (alreadyPublished) {
    yield* Effect.sync(() => console.log(`${name}@${version} is already on npm; skipping publish.`));
  } else {
    // Build explicitly with pnpm before publishing. npm otherwise runs the
    // package's prepublishOnly hook inside its own publish process, which can
    // fail in CI because the package manager environment is nested. The
    // declaration build validates the distributable package, and the generated
    // dist directory is included in the package, so npm's lifecycle scripts
    // are not needed here.
    yield* command("pnpm", ["build"]);
    yield* command("npm", ["publish", "--ignore-scripts", "--provenance", "--access", "public"]);
  }

  // npm's write endpoint can succeed a few seconds before registry reads see
  // the new version. Poll before declaring a successful publish missing.
  const published = yield* commandEventuallySucceeds(
    "npm",
    ["view", `${name}@${version}`, "version"],
  );
  if (!published) {
    return yield* Effect.fail(new ReleaseError({
      message: `${name}@${version} was not found on npm after publishing`
    }));
  }

  const releaseExists = yield* commandSucceeds("gh", ["release", "view", tag]);
  if (releaseExists) {
    yield* Effect.sync(() => console.log(`GitHub Release ${tag} already exists; skipping creation.`));
    return;
  }

  const changelog = yield* read(changelogPath);
  const escapedVersion = version.replace(/\./g, "\\.");
  const entry = changelog.match(
    new RegExp(`^## ${escapedVersion}(?:\\s+—[^\\n]*)?\\n\\n([\\s\\S]*?)(?=\\n## |$)`, "m")
  );
  const notes = entry?.[1]?.trim() ?? `Release ${tag}`;

  const releaseNotes = join(root, `.release-notes-${version}.md`);
  yield* write(releaseNotes, `## What's Changed\n\n${notes}\n`);
  yield* command("gh", ["release", "create", tag, "--title", tag, "--notes-file", releaseNotes]);
  yield* remove(releaseNotes);
  yield* Effect.sync(() => console.log(`Released ${tag}.`));
});

const program = prepare === publish
  ? Effect.fail(new ReleaseError({
      message: "Choose exactly one release mode: --prepare, --publish, or --dry-run"
    }))
  : prepare
    ? prepareRelease
    : publishRelease;

Effect.runPromise(program).catch((error) => {
  if (error instanceof ReleaseError) {
    console.error(error.message, error.cause ?? "");
  } else {
    console.error(error);
  }
  process.exitCode = 1;
});
