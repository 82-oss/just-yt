import { readFileSync } from 'node:fs';

/**
 * The published package version, read from the SDK's own manifest at build
 * time. The docs sat on a hand-copied version string for two releases; the
 * footer is not worth a step in the release checklist.
 */
export const VERSION: string = JSON.parse(
  readFileSync(new URL('../../../package.json', import.meta.url), 'utf8'),
).version;
