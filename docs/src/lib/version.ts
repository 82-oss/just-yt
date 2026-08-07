declare const __JUST_YT_VERSION__: string;

/**
 * The published package version, injected from the repo root `package.json`
 * when Astro starts. A runtime `readFileSync` against `import.meta.url` breaks
 * once Vite bundles the module — the relative path then lands on
 * `docs/package.json` instead of the SDK manifest.
 */
export const VERSION: string = __JUST_YT_VERSION__;
