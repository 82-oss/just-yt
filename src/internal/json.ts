/**
 * Tolerant navigation over raw Innertube JSON.
 *
 * Innertube responses are deeply nested, inconsistently shaped, and change
 * without notice. Everything here treats a missing or unexpected value as
 * `undefined` rather than an error, so a single renderer rename degrades one
 * field instead of failing an entire response. Extractors decide which of those
 * fields are load-bearing enough to raise an `ExtractionError`.
 */

export type Json = unknown;

export const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

export const isArray = (value: unknown): value is ReadonlyArray<unknown> =>
  Array.isArray(value);

/** Reads a dotted path, e.g. `get(res, "contents.sectionListRenderer.contents")`. */
export const get = (value: unknown, path: string): unknown => {
  let current = value;
  for (const key of path.split(".")) {
    if (current === undefined || current === null) return undefined;
    if (isArray(current)) {
      const index = Number(key);
      if (!Number.isInteger(index)) return undefined;
      current = current[index];
      continue;
    }
    if (!isObject(current)) return undefined;
    current = current[key];
  }
  return current;
};

export const getObject = (
  value: unknown,
  path: string,
): Record<string, unknown> | undefined => {
  const result = get(value, path);
  return isObject(result) ? result : undefined;
};

export const getArray = (
  value: unknown,
  path: string,
): ReadonlyArray<unknown> => {
  const result = get(value, path);
  return isArray(result) ? result : [];
};

export const getString = (
  value: unknown,
  path: string,
): string | undefined => {
  const result = get(value, path);
  return typeof result === "string" ? result : undefined;
};

export const getNumber = (
  value: unknown,
  path: string,
): number | undefined => {
  const result = get(value, path);
  if (typeof result === "number") return result;
  if (typeof result === "string") {
    const parsed = Number(result.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
};

export const getBoolean = (
  value: unknown,
  path: string,
): boolean | undefined => {
  const result = get(value, path);
  return typeof result === "boolean" ? result : undefined;
};

/**
 * Depth-first search for the first object carrying `key`, returning that key's
 * value. This is deliberately structure-blind: YouTube regularly moves a
 * renderer between wrappers while leaving the renderer itself untouched, and a
 * key search survives that where a fixed path does not.
 */
export const findFirst = (
  value: unknown,
  key: string,
  maxDepth = 24,
): unknown => {
  if (maxDepth < 0) return undefined;

  if (isArray(value)) {
    for (const item of value) {
      const found = findFirst(item, key, maxDepth - 1);
      if (found !== undefined) return found;
    }
    return undefined;
  }

  if (!isObject(value)) return undefined;

  if (key in value && value[key] !== undefined) return value[key];

  for (const child of Object.values(value)) {
    const found = findFirst(child, key, maxDepth - 1);
    if (found !== undefined) return found;
  }

  return undefined;
};

/** Collects every value stored under `key`, in document order. */
export const findAll = (
  value: unknown,
  key: string,
  maxDepth = 24,
): ReadonlyArray<unknown> => {
  const results: unknown[] = [];

  const walk = (node: unknown, depth: number): void => {
    if (depth < 0) return;

    if (isArray(node)) {
      for (const item of node) walk(item, depth - 1);
      return;
    }

    if (!isObject(node)) return;

    if (key in node && node[key] !== undefined) results.push(node[key]);

    for (const child of Object.values(node)) walk(child, depth - 1);
  };

  walk(value, maxDepth);
  return results;
};

/**
 * Flattens a `Text`-shaped node to a plain string.
 *
 * Covers the four encodings in circulation: `simpleText`, `runs`, the newer
 * attributed-string `content`, and bare strings.
 */
export const text = (node: unknown): string | undefined => {
  if (typeof node === "string") return node;
  if (!isObject(node)) return undefined;

  if (typeof node.simpleText === "string") return node.simpleText;

  if (isArray(node.runs)) {
    const joined = node.runs
      .map((run) => (isObject(run) && typeof run.text === "string" ? run.text : ""))
      .join("");
    if (joined.length > 0) return joined;
  }

  if (typeof node.content === "string") return node.content;

  // Attributed strings wrap the payload one level deeper.
  const attributed = get(node, "attributedString.content");
  if (typeof attributed === "string") return attributed;

  const label = get(node, "accessibility.accessibilityData.label");
  if (typeof label === "string") return label;

  return undefined;
};

export const textAt = (value: unknown, path: string): string | undefined =>
  text(get(value, path));

export interface Thumbnail {
  readonly url: string;
  readonly width?: number;
  readonly height?: number;
}

/** Reads a thumbnail list from either `{ thumbnails: [...] }` or a bare array. */
export const thumbnails = (node: unknown): ReadonlyArray<Thumbnail> => {
  const list = isArray(node)
    ? node
    : isObject(node) && isArray(node.thumbnails)
      ? node.thumbnails
      : isArray(get(node, "sources"))
        ? (get(node, "sources") as ReadonlyArray<unknown>)
        : [];

  return list.flatMap((item) => {
    if (!isObject(item) || typeof item.url !== "string") return [];
    const url = item.url.startsWith("//") ? `https:${item.url}` : item.url;
    return [
      {
        url,
        width: typeof item.width === "number" ? item.width : undefined,
        height: typeof item.height === "number" ? item.height : undefined,
      },
    ];
  });
};

/**
 * Parses the human-readable counts YouTube renders, e.g. `"1.2M views"`,
 * `"1,234,567"`, `"12K subscribers"`, `"No views"`.
 */
export const parseCount = (value: unknown): number | undefined => {
  const raw = typeof value === "string" ? value : text(value);
  if (raw === undefined) return undefined;

  // Locales use commas, non-breaking spaces, or thin spaces as group separators.
  const match = raw
    .replace(/[,   ]/g, "")
    .replace(/(\d)\s+(?=\d)/g, "$1")
    .match(/(\d+(?:\.\d+)?)\s*([KMB])?/i);

  if (match === null) return undefined;

  const amount = Number(match[1]);
  if (!Number.isFinite(amount)) return undefined;

  const multiplier = { K: 1_000, M: 1_000_000, B: 1_000_000_000 }[
    (match[2] ?? "").toUpperCase()
  ];

  return Math.round(amount * (multiplier ?? 1));
};

/** Converts `"1:02:03"`-style durations to seconds. */
export const parseDuration = (value: unknown): number | undefined => {
  const raw = typeof value === "string" ? value : text(value);
  if (raw === undefined) return undefined;

  const parts = raw
    .trim()
    .split(":")
    .map((part) => Number(part.replace(/\D/g, "")));

  if (parts.some((part) => !Number.isFinite(part))) return undefined;

  switch (parts.length) {
    case 1:
      return parts[0];
    case 2:
      return parts[0] * 60 + parts[1];
    case 3:
      return parts[0] * 3600 + parts[1] * 60 + parts[2];
    default:
      return undefined;
  }
};
